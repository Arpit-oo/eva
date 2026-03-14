import { NextResponse } from "next/server"

const META_REDIRECT_URI = "https://eva-project.vercel.app/api/social/meta/callback"

export async function GET(request: Request) {
  try {
    const clientId = process.env.META_APP_ID?.trim()
    if (!clientId) {
      throw new Error("META_APP_ID is not configured")
    }

    const state = `${Date.now()}:${Math.random().toString(36).slice(2, 18)}`
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: META_REDIRECT_URI,
      response_type: "code",
      scope: "pages_show_list,pages_manage_posts,pages_read_engagement,public_profile",
      state,
    })

    return NextResponse.redirect(`https://www.facebook.com/v19.0/dialog/oauth?${params.toString()}`)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to start Facebook OAuth"
    return NextResponse.redirect(new URL(`/settings?social_error=${encodeURIComponent(message)}`, request.url))
  }
}
