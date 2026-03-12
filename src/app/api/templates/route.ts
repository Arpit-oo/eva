import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: templates, error } = await supabase
    .from("Templates")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ templates: templates ?? [] })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json()
  const { post_id, template_name } = body as { post_id?: string; template_name: string }

  if (!template_name?.trim()) {
    return NextResponse.json({ error: "template_name is required" }, { status: 400 })
  }

  let caption = body.caption
  let hashtags = body.hashtags
  let image_prompt = body.image_prompt ?? null

  // If post_id given, copy from that post
  if (post_id) {
    const { data: post, error: postError } = await supabase
      .from("Posts")
      .select("caption, hashtags, image_prompt")
      .eq("id", post_id)
      .eq("user_id", user.id)
      .single()
    if (postError || !post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 })
    }
    caption = post.caption
    hashtags = post.hashtags
    image_prompt = post.image_prompt
  }

  if (!caption) return NextResponse.json({ error: "caption is required" }, { status: 400 })

  const { data: template, error } = await supabase
    .from("Templates")
    .insert({ user_id: user.id, template_name, caption, hashtags: hashtags ?? [], image_prompt })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ template }, { status: 201 })
}
