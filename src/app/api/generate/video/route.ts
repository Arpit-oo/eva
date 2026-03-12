import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import { fal } from "@fal-ai/client"
import { GoogleGenAI } from "@google/genai"

// fal.ai client
if (process.env.FAL_API_KEY) {
  fal.config({ credentials: process.env.FAL_API_KEY })
}

// Veo 2 client
const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_AI_API_KEY ?? "" })

// Supabase admin client for storage uploads
const adminSupabase = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const STORAGE_BUCKET = "post-media"

async function ensureBucket() {
  const { data: buckets } = await adminSupabase.storage.listBuckets()
  const exists = buckets?.some((b) => b.name === STORAGE_BUCKET)
  if (!exists) {
    await adminSupabase.storage.createBucket(STORAGE_BUCKET, {
      public: true,
      fileSizeLimit: 52428800, // 50MB
    })
  }
}

async function uploadVideoToStorage(videoData: Buffer | Uint8Array, filename: string): Promise<string> {
  await ensureBucket()
  const { data, error } = await adminSupabase.storage
    .from(STORAGE_BUCKET)
    .upload(filename, videoData, { contentType: "video/mp4", upsert: true })
  if (error) throw new Error(`Storage upload failed: ${error.message}`)
  const { data: urlData } = adminSupabase.storage.from(STORAGE_BUCKET).getPublicUrl(data.path)
  return urlData.publicUrl
}

// ─── fal.ai handler ────────────────────────────────────────────────────────
async function generateWithFal(prompt: string): Promise<string> {
  if (!process.env.FAL_API_KEY) throw new Error("FAL_API_KEY is not configured")

  // WanVideo 2.1 — text to video, fast 1.3B model
  const result = await fal.subscribe("fal-ai/wan/v2.1/1.3b", {
    input: {
      prompt,
      negative_prompt: "low quality, blurry, distorted, watermark, text overlay",
      num_frames: 81,
      frames_per_second: 16,
      resolution: "480p",
      num_inference_steps: 30,
    },
    // poll every 5s, timeout after 5 min
    pollInterval: 5000,
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const videoUrl = (result.data as any)?.video?.url
  if (!videoUrl) throw new Error("fal.ai returned no video URL")
  return videoUrl as string
}

// ─── Google Veo 2 handler ───────────────────────────────────────────────────
async function generateWithVeo2(prompt: string, userId: string): Promise<string> {
  if (!process.env.GOOGLE_AI_API_KEY) throw new Error("GOOGLE_AI_API_KEY is not configured")

  // Start generation
  let operation = await ai.models.generateVideos({
    model: "veo-2.0-generate-001",
    prompt,
    config: {
      numberOfVideos: 1,
      durationSeconds: 5,
      aspectRatio: "9:16",
      personGeneration: "ALLOW_ADULT",
    },
  })

  // Poll until done (max 10 minutes)
  const deadline = Date.now() + 10 * 60 * 1000
  while (!operation.done) {
    if (Date.now() > deadline) throw new Error("Veo 2 generation timed out after 10 minutes")
    await new Promise((r) => setTimeout(r, 8000))
    operation = await ai.operations.getVideosOperation({ operation })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const videoData = (operation.response as any)?.generatedVideos?.[0]?.video
  if (!videoData) throw new Error("Veo 2 returned no video")

  // If we have bytes, upload to Supabase Storage
  if (videoData.videoBytes) {
    const bytes =
      typeof videoData.videoBytes === "string"
        ? Buffer.from(videoData.videoBytes, "base64")
        : Buffer.from(videoData.videoBytes)
    const filename = `videos/${userId}/${Date.now()}.mp4`
    return await uploadVideoToStorage(bytes, filename)
  }

  // If we have a URI (download it)
  if (videoData.uri) {
    return videoData.uri as string
  }

  throw new Error("Veo 2 produced no downloadable video")
}

// ─── Route handler ──────────────────────────────────────────────────────────
export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { prompt, post_id, provider = "fal" } = await request.json() as {
    prompt: string
    post_id?: string
    provider?: "fal" | "veo2"
  }
  if (!prompt) return NextResponse.json({ error: "prompt is required" }, { status: 400 })

  try {
    let videoUrl: string

    if (provider === "veo2") {
      videoUrl = await generateWithVeo2(prompt, user.id)
    } else {
      videoUrl = await generateWithFal(prompt)
    }

    // Persist to post if post_id given
    if (post_id) {
      await supabase
        .from("Posts")
        .update({ video_url: videoUrl })
        .eq("id", post_id)
        .eq("user_id", user.id)
    }

    return NextResponse.json({ video_url: videoUrl, provider })
  } catch (err: unknown) {
    console.error(`Video generation (${provider}) failed:`, err)
    const message = err instanceof Error ? err.message : "Video generation failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
