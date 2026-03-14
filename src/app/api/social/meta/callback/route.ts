import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

const META_REDIRECT_URI = "https://eva-project.vercel.app/api/social/meta/callback"

type MetaTokenResponse = {
  access_token: string
  expires_in?: number
}

type MetaPage = {
  id: string
  name: string
  access_token: string
}

type MetaPagesResponse = {
  data?: MetaPage[]
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.redirect(new URL("/login", request.url))

  const url = new URL(request.url)
  const code = url.searchParams.get("code")
  const error = url.searchParams.get("error")
  const errorDescription = url.searchParams.get("error_description")

  if (error) {
    return NextResponse.redirect(
      new URL(`/settings?social_error=${encodeURIComponent(errorDescription ?? error)}`, request.url)
    )
  }

  if (!code) {
    return NextResponse.redirect(new URL("/settings?social_error=Missing+authorization+code", request.url))
  }

  try {
    const appId = process.env.META_APP_ID?.trim()
    const appSecret = process.env.META_APP_SECRET?.trim()

    if (!appId || !appSecret) {
      throw new Error("META_APP_ID or META_APP_SECRET is not configured")
    }

    const tokenParams = new URLSearchParams({
      client_id: appId,
      client_secret: appSecret,
      redirect_uri: META_REDIRECT_URI,
      code,
    })

    const tokenRes = await fetch(`https://graph.facebook.com/v19.0/oauth/access_token?${tokenParams.toString()}`)
    const tokenRaw = await tokenRes.text()
    if (!tokenRes.ok) throw new Error(`Facebook token exchange failed: ${tokenRaw}`)
    const tokenData = JSON.parse(tokenRaw) as MetaTokenResponse

    const userAccessToken = tokenData.access_token
    if (!userAccessToken) throw new Error("Facebook token exchange failed: missing access token")

    const pagesRes = await fetch(
      `https://graph.facebook.com/v19.0/me/accounts?access_token=${encodeURIComponent(userAccessToken)}`
    )
    const pagesRaw = await pagesRes.text()
    if (!pagesRes.ok) throw new Error(`Facebook pages fetch failed: ${pagesRaw}`)
    const pagesData = JSON.parse(pagesRaw) as MetaPagesResponse

    if (!pagesData.data || pagesData.data.length === 0) {
      throw new Error("No Facebook Page found for this account.")
    }

    const page = pagesData.data[0]

    const expiresAt = tokenData.expires_in
      ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
      : null

    const { error: upsertError } = await supabase
      .from("SocialConnections")
      .upsert(
        {
          user_id: user.id,
          platform: "facebook",
          platform_user_id: page.id,
          platform_username: page.name,
          access_token: page.access_token,
          refresh_token: null,
          token_expires_at: expiresAt,
          meta_page_id: page.id,
          status: "active",
        },
        { onConflict: "user_id,platform" }
      )

    if (upsertError) {
      throw new Error(upsertError.message)
    }

    return NextResponse.redirect(new URL("/settings?social_connected=facebook", request.url))
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "OAuth connection failed"
    return NextResponse.redirect(new URL(`/settings?social_error=${encodeURIComponent(message)}`, request.url))
  }
}
