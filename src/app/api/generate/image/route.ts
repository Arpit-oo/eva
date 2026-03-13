import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"

const STORAGE_BUCKET = "post-media"

const adminSupabase = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function ensureBucket() {
  const { data: buckets } = await adminSupabase.storage.listBuckets()
  const exists = buckets?.some((bucket) => bucket.name === STORAGE_BUCKET)
  if (!exists) {
    await adminSupabase.storage.createBucket(STORAGE_BUCKET, {
      public: true,
      fileSizeLimit: 52428800,
    })
  }
}

function parseImagePayload(imageBase64: string, mimeType?: string) {
  const dataUrlMatch = imageBase64.match(/^data:([^;]+);base64,(.+)$/)
  if (dataUrlMatch) {
    return {
      mimeType: mimeType || dataUrlMatch[1],
      base64Data: dataUrlMatch[2],
    }
  }

  if (!mimeType) {
    throw new Error("mime_type is required when image_base64 is not a data URL")
  }

  return {
    mimeType,
    base64Data: imageBase64,
  }
}

function extensionForMimeType(mimeType: string) {
  if (mimeType === "image/jpeg") return "jpg"
  if (mimeType === "image/webp") return "webp"
  if (mimeType === "image/gif") return "gif"
  return "png"
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { image_base64, mime_type, post_id } = (await request.json()) as {
    image_base64?: string
    mime_type?: string
    post_id?: string
  }
  if (!image_base64) {
    return NextResponse.json({ error: "image_base64 is required" }, { status: 400 })
  }

  try {
    const parsed = parseImagePayload(image_base64, mime_type)
    const buffer = Buffer.from(parsed.base64Data, "base64")
    const extension = extensionForMimeType(parsed.mimeType)
    const filePath = `images/${user.id}/${Date.now()}-${crypto.randomUUID()}.${extension}`

    await ensureBucket()

    const { data, error: uploadError } = await adminSupabase.storage
      .from(STORAGE_BUCKET)
      .upload(filePath, buffer, {
        contentType: parsed.mimeType,
        upsert: true,
      })

    if (uploadError) {
      throw new Error(`Storage upload failed: ${uploadError.message}`)
    }

    const { data: publicUrlData } = adminSupabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(data.path)

    const imageUrl = publicUrlData.publicUrl

    if (post_id) {
      await supabase
        .from("Posts")
        .update({ image_url: imageUrl })
        .eq("id", post_id)
        .eq("user_id", user.id)
    }

    return NextResponse.json({ image_url: imageUrl })
  } catch (err: unknown) {
    console.error("Image upload failed:", err)
    const message = err instanceof Error ? err.message : "Image upload failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
