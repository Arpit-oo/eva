import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { handleOAuthCallback } from "@/lib/social"

export async function GET(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.redirect(new URL("/login", request.url))

  const url = new URL(request.url)
  const code = url.searchParams.get("code")
  const state = url.searchParams.get("state") ?? ""
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
    await handleOAuthCallback({
      platform: "twitter",
      code,
      requestUrl: request.url,
      state,
      userId: user.id,
    })

    return NextResponse.redirect(new URL("/settings?social_connected=twitter", request.url))
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "OAuth connection failed"
    return NextResponse.redirect(new URL(`/settings?social_error=${encodeURIComponent(message)}`, request.url))
  }
}
