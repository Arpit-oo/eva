import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { handleOAuthCallback } from "@/lib/social"
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

  const platform = params.platform.toLowerCase() as SocialPlatform

  try {
    await handleOAuthCallback({
      platform,
      code,
      requestUrl: request.url,
      state,
      userId: user.id,
    })

    return NextResponse.redirect(new URL(`/settings?social_connected=${platform}`, request.url))
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "OAuth connection failed"
    return NextResponse.redirect(new URL(`/settings?social_error=${encodeURIComponent(message)}`, request.url))
  }
}
