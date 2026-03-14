import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json()
  const {
    platform,
    caption,
    hashtags,
    image_prompt,
    image_url,
    video_url,
    scheduled_date,
    scheduled_time,
    status,
  } = body

  if (!platform || !caption) {
    return NextResponse.json({ error: "platform and caption are required" }, { status: 400 })
  }

  const { data: post, error } = await supabase
    .from("Posts")
    .insert({
      user_id: user.id,
      platform,
      caption,
      hashtags: Array.isArray(hashtags) ? hashtags : [],
      image_prompt: image_prompt ?? null,
      image_url: image_url ?? null,
      video_url: video_url ?? null,
      scheduled_date: scheduled_date ?? null,
      scheduled_time: scheduled_time ?? null,
      status: status ?? "draft",
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ post }, { status: 201 })
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const startDate = searchParams.get("start_date")
  const endDate = searchParams.get("end_date")
  const platform = searchParams.get("platform")

  let query = supabase
    .from("Posts")
    .select("*")
    .eq("user_id", user.id)
    .order("scheduled_date", { ascending: true })
    .order("scheduled_time", { ascending: true })

  if (startDate) query = query.gte("scheduled_date", startDate)
  if (endDate) query = query.lte("scheduled_date", endDate)
  if (platform) query = query.eq("platform", platform)

  const { data: posts, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ posts: posts ?? [] })
}
