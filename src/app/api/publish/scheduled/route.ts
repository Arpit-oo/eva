import { NextResponse } from "next/server"
import { createAdminSupabase, isDueNow, publishPostToPlatform } from "@/lib/social"
import type { PostRow, SocialConnectionRow } from "@/lib/types"

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) return true
  const auth = request.headers.get("authorization")
  return auth === `Bearer ${secret}`
}

async function runPublisher() {
  const supabase = createAdminSupabase()

  const { data: posts, error } = await supabase
    .from("Posts")
    .select("*")
    .eq("status", "scheduled")
    .order("scheduled_date", { ascending: true })
    .order("scheduled_time", { ascending: true })
    .limit(100)

  if (error) throw new Error(error.message)

  const duePosts = ((posts ?? []) as PostRow[]).filter((p) => isDueNow(p))

  let published = 0
  let failed = 0

  for (const post of duePosts) {
    const { data: connection, error: connErr } = await supabase
      .from("SocialConnections")
      .select("*")
      .eq("user_id", post.user_id)
      .eq("platform", post.platform)
      .single()

    if (connErr || !connection) {
      failed += 1
      await supabase
        .from("Posts")
        .update({ status: "failed", publish_error: `No active ${post.platform} connection found` })
        .eq("id", post.id)
      continue
    }

    try {
      const platformPostId = await publishPostToPlatform(post, connection as SocialConnectionRow)
      published += 1
      await supabase
        .from("Posts")
        .update({
          status: "published",
          platform_post_id: platformPostId,
          publish_error: null,
          published_at: new Date().toISOString(),
        })
        .eq("id", post.id)
    } catch (err: unknown) {
      failed += 1
      const message = err instanceof Error ? err.message.slice(0, 1000) : "Publish failed"
      await supabase
        .from("Posts")
        .update({ status: "failed", publish_error: message })
        .eq("id", post.id)
    }
  }

  return { checked: duePosts.length, published, failed }
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const result = await runPublisher()
    return NextResponse.json({ ok: true, ...result })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Scheduled publish failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  return GET(request)
}
