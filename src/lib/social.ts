import { createClient as createSupabaseClient } from "@supabase/supabase-js"
import type { PostRow, SocialConnectionRow, SocialPlatform } from "@/lib/types"

type OAuthTokenResult = {
  accessToken: string
  refreshToken?: string | null
  expiresIn?: number | null
}

export function getAppBaseUrl(requestUrl?: string) {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL.trim().replace(/\/$/, "")
  if (requestUrl) return new URL(requestUrl).origin
  return "http://localhost:3000"
}

export function createAdminSupabase() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

function assertEnv(name: string) {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} is not configured`)
  return value
}

function toFormBody(params: Record<string, string>) {
  const body = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) body.set(k, v)
  return body.toString()
}

function parseJsonSafe(text: string) {
  try {
    return JSON.parse(text)
  } catch {
    return { raw: text }
  }
}

export function getOAuthRedirectUri(platform: SocialPlatform, requestUrl: string) {
  if (platform === "linkedin") {
    return `${getAppBaseUrl(requestUrl)}/api/social/linkedin/callback`
  }
  return `${getAppBaseUrl(requestUrl)}/api/social/callback/${platform}`
}

export function getOAuthAuthorizeUrl(platform: SocialPlatform, requestUrl: string, state: string) {
  const redirectUri = getOAuthRedirectUri(platform, requestUrl)

  if (platform === "linkedin") {
    const clientId = assertEnv("LINKEDIN_CLIENT_ID")
    const params = new URLSearchParams({
      response_type: "code",
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: "openid profile email w_member_social",
      state,
    })
    return `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`
  }

  if (platform === "twitter") {
    const clientId = assertEnv("TWITTER_CLIENT_ID")
    const params = new URLSearchParams({
      response_type: "code",
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: "tweet.read tweet.write users.read offline.access",
      state,
      code_challenge: state,
      code_challenge_method: "plain",
    })
    return `https://twitter.com/i/oauth2/authorize?${params.toString()}`
  }

  if (platform === "facebook" || platform === "instagram") {
    const appId = assertEnv("META_APP_ID")
    const params = new URLSearchParams({
      client_id: appId,
      redirect_uri: redirectUri,
      state,
      scope: "pages_show_list,pages_manage_posts,pages_read_engagement,instagram_basic,instagram_content_publish,business_management",
    })
    return `https://www.facebook.com/v20.0/dialog/oauth?${params.toString()}`
  }

  throw new Error(`Unsupported platform: ${platform}`)
}

async function exchangeLinkedInCode(code: string, redirectUri: string): Promise<OAuthTokenResult> {
  const clientId = assertEnv("LINKEDIN_CLIENT_ID")
  const clientSecret = assertEnv("LINKEDIN_CLIENT_SECRET")

  const res = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: toFormBody({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  })

  const text = await res.text()
  if (!res.ok) throw new Error(`LinkedIn token exchange failed: ${text}`)
  const json = parseJsonSafe(text) as { access_token: string; expires_in?: number }
  return {
    accessToken: json.access_token,
    expiresIn: json.expires_in ?? null,
    refreshToken: null,
  }
}

async function exchangeTwitterCode(code: string, redirectUri: string, state: string): Promise<OAuthTokenResult> {
  const clientId = assertEnv("TWITTER_CLIENT_ID")
  const clientSecret = assertEnv("TWITTER_CLIENT_SECRET")
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64")

  const res = await fetch("https://api.twitter.com/2/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basic}`,
    },
    body: toFormBody({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      code_verifier: state,
    }),
  })

  const text = await res.text()
  if (!res.ok) throw new Error(`X token exchange failed: ${text}`)
  const json = parseJsonSafe(text) as {
    access_token: string
    refresh_token?: string
    expires_in?: number
  }
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token ?? null,
    expiresIn: json.expires_in ?? null,
  }
}

async function exchangeMetaCode(code: string, redirectUri: string): Promise<OAuthTokenResult> {
  const appId = assertEnv("META_APP_ID")
  const appSecret = assertEnv("META_APP_SECRET")

  const params = new URLSearchParams({
    client_id: appId,
    client_secret: appSecret,
    redirect_uri: redirectUri,
    code,
  })

  const res = await fetch(`https://graph.facebook.com/v20.0/oauth/access_token?${params.toString()}`)
  const text = await res.text()
  if (!res.ok) throw new Error(`Meta token exchange failed: ${text}`)
  const json = parseJsonSafe(text) as { access_token: string; expires_in?: number }
  return {
    accessToken: json.access_token,
    refreshToken: null,
    expiresIn: json.expires_in ?? null,
  }
}

async function getLinkedInIdentity(accessToken: string) {
  const res = await fetch("https://api.linkedin.com/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`LinkedIn userinfo failed: ${text}`)
  const data = parseJsonSafe(text) as { sub: string; name?: string }
  return {
    platformUserId: data.sub,
    platformUsername: data.name ?? null,
    accessToken,
  }
}

async function getTwitterIdentity(accessToken: string) {
  const res = await fetch("https://api.twitter.com/2/users/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`X user lookup failed: ${text}`)
  const data = parseJsonSafe(text) as { data: { id: string; username?: string } }
  return {
    platformUserId: data.data.id,
    platformUsername: data.data.username ?? null,
    accessToken,
  }
}

async function getMetaPages(accessToken: string) {
  const res = await fetch(
    `https://graph.facebook.com/v20.0/me/accounts?fields=id,name,access_token,instagram_business_account&access_token=${encodeURIComponent(accessToken)}`
  )
  const text = await res.text()
  if (!res.ok) throw new Error(`Meta pages fetch failed: ${text}`)
  const data = parseJsonSafe(text) as {
    data?: Array<{
      id: string
      name: string
      access_token: string
      instagram_business_account?: { id: string }
    }>
  }
  if (!data.data || data.data.length === 0) throw new Error("No Facebook pages found for this account")
  return data.data
}

export async function upsertSocialConnection(params: {
  userId: string
  platform: SocialPlatform
  platformUserId: string
  platformUsername: string | null
  accessToken: string
  refreshToken?: string | null
  expiresIn?: number | null
}) {
  const supabase = createAdminSupabase()
  const expiresAt = params.expiresIn
    ? new Date(Date.now() + params.expiresIn * 1000).toISOString()
    : null

  const { error } = await supabase
    .from("SocialConnections")
    .upsert(
      {
        user_id: params.userId,
        platform: params.platform,
        platform_user_id: params.platformUserId,
        platform_username: params.platformUsername,
        access_token: params.accessToken,
        refresh_token: params.refreshToken ?? null,
        token_expires_at: expiresAt,
        status: "active",
      },
      { onConflict: "user_id,platform" }
    )

  if (error) throw new Error(error.message)
}

export async function handleOAuthCallback(args: {
  platform: SocialPlatform
  code: string
  requestUrl: string
  state: string
  userId: string
}) {
  const redirectUri = getOAuthRedirectUri(args.platform, args.requestUrl)

  if (args.platform === "linkedin") {
    const tokens = await exchangeLinkedInCode(args.code, redirectUri)
    const identity = await getLinkedInIdentity(tokens.accessToken)
    await upsertSocialConnection({
      userId: args.userId,
      platform: "linkedin",
      platformUserId: identity.platformUserId,
      platformUsername: identity.platformUsername,
      accessToken: identity.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn,
    })
    return
  }

  if (args.platform === "twitter") {
    const tokens = await exchangeTwitterCode(args.code, redirectUri, args.state)
    const identity = await getTwitterIdentity(tokens.accessToken)
    await upsertSocialConnection({
      userId: args.userId,
      platform: "twitter",
      platformUserId: identity.platformUserId,
      platformUsername: identity.platformUsername,
      accessToken: identity.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn,
    })
    return
  }

  if (args.platform === "facebook" || args.platform === "instagram") {
    const tokens = await exchangeMetaCode(args.code, redirectUri)
    const pages = await getMetaPages(tokens.accessToken)

    if (args.platform === "facebook") {
      const page = pages[0]
      await upsertSocialConnection({
        userId: args.userId,
        platform: "facebook",
        platformUserId: page.id,
        platformUsername: page.name,
        accessToken: page.access_token,
        refreshToken: null,
        expiresIn: tokens.expiresIn,
      })
      return
    }

    const pageWithIg = pages.find((p) => p.instagram_business_account?.id)
    if (!pageWithIg?.instagram_business_account?.id) {
      throw new Error("No Instagram Business account linked to your Facebook pages")
    }

    const igId = pageWithIg.instagram_business_account.id
    const igRes = await fetch(
      `https://graph.facebook.com/v20.0/${igId}?fields=username&access_token=${encodeURIComponent(pageWithIg.access_token)}`
    )
    const igText = await igRes.text()
    if (!igRes.ok) throw new Error(`Instagram profile fetch failed: ${igText}`)
    const igData = parseJsonSafe(igText) as { username?: string }

    await upsertSocialConnection({
      userId: args.userId,
      platform: "instagram",
      platformUserId: igId,
      platformUsername: igData.username ?? null,
      accessToken: pageWithIg.access_token,
      refreshToken: null,
      expiresIn: tokens.expiresIn,
    })
    return
  }

  throw new Error(`Unsupported platform: ${args.platform}`)
}

async function publishToLinkedIn(post: PostRow, connection: SocialConnectionRow) {
  const text = `${post.caption}\n\n${(post.hashtags ?? []).map((h) => `#${h}`).join(" ")}`.trim()
  const body = {
    author: `urn:li:person:${connection.platform_user_id}`,
    lifecycleState: "PUBLISHED",
    specificContent: {
      "com.linkedin.ugc.ShareContent": {
        shareCommentary: { text },
        shareMediaCategory: "NONE",
      },
    },
    visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" },
  }

  const res = await fetch("https://api.linkedin.com/v2/ugcPosts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${connection.access_token}`,
      "Content-Type": "application/json",
      "X-Restli-Protocol-Version": "2.0.0",
    },
    body: JSON.stringify(body),
  })

  const textRes = await res.text()
  if (!res.ok) throw new Error(`LinkedIn publish failed: ${textRes}`)
  const entityId = res.headers.get("x-restli-id")
  return entityId ?? `linkedin:${post.id}`
}

async function publishToTwitter(post: PostRow, connection: SocialConnectionRow) {
  const text = `${post.caption}\n\n${(post.hashtags ?? []).map((h) => `#${h}`).join(" ")}`.trim()
  const res = await fetch("https://api.twitter.com/2/tweets", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${connection.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text: text.slice(0, 280) }),
  })

  const raw = await res.text()
  if (!res.ok) throw new Error(`X publish failed: ${raw}`)
  const data = parseJsonSafe(raw) as { data?: { id?: string } }
  if (!data.data?.id) throw new Error("X publish failed: missing tweet id")
  return data.data.id
}

async function publishToFacebook(post: PostRow, connection: SocialConnectionRow) {
  const message = `${post.caption}\n\n${(post.hashtags ?? []).map((h) => `#${h}`).join(" ")}`.trim()
  const params = new URLSearchParams({
    message,
    access_token: connection.access_token,
  })
  const res = await fetch(`https://graph.facebook.com/v20.0/${connection.platform_user_id}/feed`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  })

  const raw = await res.text()
  if (!res.ok) throw new Error(`Facebook publish failed: ${raw}`)
  const data = parseJsonSafe(raw) as { id?: string }
  if (!data.id) throw new Error("Facebook publish failed: missing post id")
  return data.id
}

async function publishToInstagram(post: PostRow, connection: SocialConnectionRow) {
  if (!post.image_url) {
    throw new Error("Instagram publish requires an image_url")
  }

  const caption = `${post.caption}\n\n${(post.hashtags ?? []).map((h) => `#${h}`).join(" ")}`.trim()

  const createParams = new URLSearchParams({
    image_url: post.image_url,
    caption,
    access_token: connection.access_token,
  })

  const createRes = await fetch(`https://graph.facebook.com/v20.0/${connection.platform_user_id}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: createParams.toString(),
  })

  const createRaw = await createRes.text()
  if (!createRes.ok) throw new Error(`Instagram media create failed: ${createRaw}`)
  const createData = parseJsonSafe(createRaw) as { id?: string }
  if (!createData.id) throw new Error("Instagram media create failed: missing container id")

  const publishParams = new URLSearchParams({
    creation_id: createData.id,
    access_token: connection.access_token,
  })
  const publishRes = await fetch(`https://graph.facebook.com/v20.0/${connection.platform_user_id}/media_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: publishParams.toString(),
  })

  const publishRaw = await publishRes.text()
  if (!publishRes.ok) throw new Error(`Instagram publish failed: ${publishRaw}`)
  const publishData = parseJsonSafe(publishRaw) as { id?: string }
  if (!publishData.id) throw new Error("Instagram publish failed: missing post id")
  return publishData.id
}

export async function publishPostToPlatform(post: PostRow, connection: SocialConnectionRow) {
  if (post.platform === "linkedin") return publishToLinkedIn(post, connection)
  if (post.platform === "twitter") return publishToTwitter(post, connection)
  if (post.platform === "facebook") return publishToFacebook(post, connection)
  if (post.platform === "instagram") return publishToInstagram(post, connection)
  throw new Error(`Unsupported platform: ${post.platform}`)
}

export function isDueNow(post: Pick<PostRow, "scheduled_date" | "scheduled_time">, now = new Date()) {
  if (!post.scheduled_date || !post.scheduled_time) return false
  const scheduledAt = new Date(`${post.scheduled_date}T${post.scheduled_time}`)
  return scheduledAt.getTime() <= now.getTime()
}
