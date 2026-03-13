import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import { generateVideo } from "@/lib/replicate-video"

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

async function uploadVideoFromUrl(sourceUrl: string, userId: string) {
  const response = await fetch(sourceUrl)
  if (!response.ok) {
    throw new Error(`Failed to download Replicate video: ${response.status}`)
  }

  const arrayBuffer = await response.arrayBuffer()
  const filename = `videos/${userId}/${Date.now()}-${crypto.randomUUID()}.mp4`
  return uploadVideoToStorage(Buffer.from(arrayBuffer), filename)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { prompt, post_id } = await request.json() as {
    prompt: string
    post_id?: string
  }
  if (!prompt) return NextResponse.json({ error: "prompt is required" }, { status: 400 })

  try {
    const replicateVideoUrl = await generateVideo(prompt)
    const videoUrl = await uploadVideoFromUrl(replicateVideoUrl, user.id)

    // Persist to post if post_id given
    if (post_id) {
      await supabase
        .from("Posts")
        .update({ video_url: videoUrl })
        .eq("id", post_id)
        .eq("user_id", user.id)
    }

    return NextResponse.json({ video_url: videoUrl, provider: "replicate" })
  } catch (err: unknown) {
    console.error("Video generation (replicate) failed:", err)
    const message = err instanceof Error ? err.message : "Video generation failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
