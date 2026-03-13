import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json()
  const { caption, hashtags, platform, scheduled_date, scheduled_time, status, image_prompt, image_url, video_url } = body

  const updates: Record<string, unknown> = {}
  if (caption !== undefined) updates.caption = caption
  if (hashtags !== undefined) updates.hashtags = hashtags
  if (platform !== undefined) updates.platform = platform
  if (scheduled_date !== undefined) updates.scheduled_date = scheduled_date
  if (scheduled_time !== undefined) updates.scheduled_time = scheduled_time
  if (status !== undefined) updates.status = status
  if (image_prompt !== undefined) updates.image_prompt = image_prompt
  if (image_url !== undefined) updates.image_url = image_url
  if (video_url !== undefined) updates.video_url = video_url

  // Auto-mark as scheduled when both schedule fields are present unless caller forced status
  if (status === undefined && (scheduled_date !== undefined || scheduled_time !== undefined)) {
    if ((scheduled_date ?? null) && (scheduled_time ?? null)) {
      updates.status = "scheduled"
    } else {
      updates.status = "draft"
    }
  }

  // Any manual edit to post payload should clear previous publish metadata
  if (
    caption !== undefined ||
    hashtags !== undefined ||
    image_prompt !== undefined ||
    image_url !== undefined ||
    video_url !== undefined ||
    platform !== undefined
  ) {
    updates.platform_post_id = null
    updates.publish_error = null
    updates.published_at = null
    if (updates.status === undefined) updates.status = "draft"
  }

  const { data: post, error } = await supabase
    .from("Posts")
    .update(updates)
    .eq("id", params.id)
    .eq("user_id", user.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ post })
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { error } = await supabase
    .from("Posts")
    .delete()
    .eq("id", params.id)
    .eq("user_id", user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
