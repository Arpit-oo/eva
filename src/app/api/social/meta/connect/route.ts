import { NextResponse } from "next/server"
import { getOAuthAuthorizeUrl } from "@/lib/social"
import type { SocialPlatform } from "@/lib/types"

function getPlatform(value: string | null): SocialPlatform {
  if (value === "facebook") return "facebook"
  return "instagram"
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const platform = getPlatform(url.searchParams.get("platform"))
    const state = `${platform}:${Date.now()}:${Math.random().toString(36).slice(2, 12)}`
    const authorizeUrl = getOAuthAuthorizeUrl(platform, request.url, state)

    console.log(`[social][meta] redirect_uri=https://eva-project.vercel.app/api/social/meta/callback`)
    console.log(`[social][meta] oauth_url=${authorizeUrl}`)

    return NextResponse.redirect(authorizeUrl)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to start Meta OAuth"
    return NextResponse.redirect(new URL(`/settings?social_error=${encodeURIComponent(message)}`, request.url))
  }
}
