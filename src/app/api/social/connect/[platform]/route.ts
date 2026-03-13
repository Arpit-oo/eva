import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getOAuthAuthorizeUrl } from "@/lib/social"
import type { SocialPlatform } from "@/lib/types"

export async function GET(
  request: Request,
  { params }: { params: { platform: string } }
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.redirect(new URL("/login", request.url))

  const platform = params.platform.toLowerCase() as SocialPlatform
  if (!["linkedin", "twitter", "instagram", "facebook"].includes(platform)) {
    return NextResponse.json({ error: "Unsupported platform" }, { status: 400 })
  }

  const state = `${user.id}:${Date.now()}`
  const url = getOAuthAuthorizeUrl(platform, request.url, state)
  return NextResponse.redirect(url)
}
