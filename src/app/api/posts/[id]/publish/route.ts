import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { publishPostToPlatform } from "@/lib/social"
import type { PostRow, SocialConnectionRow } from "@/lib/types"

export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: post, error: postErr } = await supabase
    .from("Posts")
    .select("*")
    .eq("id", params.id)
    .eq("user_id", user.id)
    .single()

  if (postErr || !post) return NextResponse.json({ error: "Post not found" }, { status: 404 })

  const postRow = post as PostRow

  const { data: connection, error: connErr } = await supabase
    .from("SocialConnections")
    .select("*")
    .eq("user_id", user.id)
    .eq("platform", postRow.platform)
    .single()

  if (connErr || !connection) {
    await supabase
      .from("Posts")
      .update({ status: "failed", publish_error: `No ${postRow.platform} account connected` })
      .eq("id", postRow.id)

    return NextResponse.json(
      { error: `No ${postRow.platform} account connected. Connect it in Settings.` },
      { status: 400 }
    )
  }

  try {
    const platformPostId = await publishPostToPlatform(postRow, connection as SocialConnectionRow)

    const { data: updated, error: updateErr } = await supabase
      .from("Posts")
      .update({
        status: "published",
        platform_post_id: platformPostId,
        publish_error: null,
        published_at: new Date().toISOString(),
      })
      .eq("id", postRow.id)
      .eq("user_id", user.id)
      .select("*")
      .single()

    if (updateErr) throw new Error(updateErr.message)

    return NextResponse.json({ post: updated })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message.slice(0, 1000) : "Publish failed"

    const { data: failedPost } = await supabase
      .from("Posts")
      .update({ status: "failed", publish_error: message })
      .eq("id", postRow.id)
      .eq("user_id", user.id)
      .select("*")
      .single()

    return NextResponse.json({ error: message, post: failedPost }, { status: 500 })
  }
}
