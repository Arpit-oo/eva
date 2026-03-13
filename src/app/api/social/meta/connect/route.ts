import { NextResponse } from "next/server"
import type { SocialPlatform } from "@/lib/types"

const META_REDIRECT_URI = "https://eva-project.vercel.app/api/social/meta/callback"

function getPlatform(value: string | null): SocialPlatform {
  if (value === "facebook") return "facebook"
  return "instagram"
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const platform = getPlatform(url.searchParams.get("platform"))
    const clientId = process.env.META_APP_ID?.trim()
    if (!clientId) {
      throw new Error("META_APP_ID is not configured")
    }

    const state = `${platform}:${Date.now()}:${Math.random().toString(36).slice(2, 12)}`
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: META_REDIRECT_URI,
      response_type: "code",
      scope: "pages_show_list,pages_read_engagement,pages_manage_posts,instagram_basic,instagram_content_publish",
      auth_type: "reauthorize",
      prompt: "select_account",
      state,
    })
    const authorizeUrl = `https://www.facebook.com/v19.0/dialog/oauth?${params.toString()}`

    console.log(`[social][meta] redirect_uri=${META_REDIRECT_URI}`)
    console.log("[social][meta] using explicit scopes flow")
    console.log(`[social][meta] oauth_url=${authorizeUrl}`)

    return NextResponse.redirect(authorizeUrl)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to start Meta OAuth"
    return NextResponse.redirect(new URL(`/settings?social_error=${encodeURIComponent(message)}`, request.url))
  }
}
