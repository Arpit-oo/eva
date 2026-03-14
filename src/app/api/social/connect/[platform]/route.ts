import { NextResponse } from "next/server"
import { getOAuthAuthorizeUrl } from "@/lib/social"
import type { SocialPlatform } from "@/lib/types"

export async function GET(
  request: Request,
  { params }: { params: { platform: string } }
) {
  try {
    const platform = params.platform.toLowerCase() as SocialPlatform
    if (!["linkedin", "twitter", "facebook"].includes(platform)) {
      return NextResponse.json({ error: "Unsupported platform" }, { status: 400 })
    }

    if (platform === "facebook") {
      return NextResponse.redirect(new URL("/api/social/meta/connect", request.url))
    }

    const state = `${Date.now()}:${Math.random().toString(36).slice(2, 12)}`
    const url = getOAuthAuthorizeUrl(platform, request.url, state)
    return NextResponse.redirect(url)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to start OAuth"
    return NextResponse.redirect(new URL(`/settings?social_error=${encodeURIComponent(message)}`, request.url))
  }
}
