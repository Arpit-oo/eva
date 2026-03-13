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
  const exists = buckets?.some((b) => b.name === STORAGE_BUCKET)
  if (!exists) {
    await adminSupabase.storage.createBucket(STORAGE_BUCKET, {
      public: true,
      fileSizeLimit: 20971520,
    })
  }
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const formData = await request.formData()
  const file = formData.get("file")

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Image file is required" }, { status: 400 })
  }

  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "Only image files are allowed" }, { status: 400 })
  }

  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "Image must be 10MB or smaller" }, { status: 400 })
  }

  const { data: post, error: postError } = await supabase
    .from("Posts")
    .select("id")
    .eq("id", params.id)
    .eq("user_id", user.id)
    .single()

  if (postError || !post) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 })
  }

  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg"
  const path = `images/${user.id}/${params.id}-${Date.now()}.${ext}`

  try {
    await ensureBucket()

    const arrayBuffer = await file.arrayBuffer()
    const { data: uploadData, error: uploadError } = await adminSupabase.storage
      .from(STORAGE_BUCKET)
      .upload(path, Buffer.from(arrayBuffer), {
        contentType: file.type,
        upsert: true,
      })

    if (uploadError) {
      throw new Error(uploadError.message)
    }

    const { data: urlData } = adminSupabase.storage.from(STORAGE_BUCKET).getPublicUrl(uploadData.path)
    const imageUrl = urlData.publicUrl

    const { error: updateError } = await supabase
      .from("Posts")
      .update({ image_url: imageUrl })
      .eq("id", params.id)
      .eq("user_id", user.id)

    if (updateError) {
      throw new Error(updateError.message)
    }

    return NextResponse.json({ image_url: imageUrl })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Image upload failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
