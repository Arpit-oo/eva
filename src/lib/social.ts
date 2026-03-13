import { createClient as createSupabaseClient } from "@supabase/supabase-js"
import type { PostRow, SocialConnectionRow, SocialPlatform } from "@/lib/types"

type OAuthTokenResult = {
  accessToken: string
  refreshToken?: string | null
  expiresIn?: number | null
}

type MetaPage = {
  id: string
  name: string
  access_token: string
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

function getMetaRedirectUri() {
  // Must exactly match the redirect URI whitelisted in Meta app settings.
  return "https://eva-project.vercel.app/api/social/meta/callback"
}


function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function getOAuthRedirectUri(platform: SocialPlatform, requestUrl: string) {
  if (platform === "linkedin") {
    return `${getAppBaseUrl(requestUrl)}/api/social/linkedin/callback`
  }
  if (platform === "twitter") {
    return `${getAppBaseUrl(requestUrl)}/api/social/x/callback`
  }
  if (platform === "facebook" || platform === "instagram") {
    return getMetaRedirectUri()
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
      response_type: "code",
      scope: "pages_show_list,pages_read_engagement,pages_manage_posts,instagram_basic,instagram_content_publish",
      auth_type: "reauthorize",
      prompt: "select_account",
    })
    return `https://www.facebook.com/v19.0/dialog/oauth?${params.toString()}`
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

  const res = await fetch(`https://graph.facebook.com/v19.0/oauth/access_token?${params.toString()}`)
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


async function getMetaPages(accessToken: string): Promise<MetaPage[]> {
  const res = await fetch(
    `https://graph.facebook.com/v19.0/me/accounts?access_token=${encodeURIComponent(accessToken)}`
  )
  const text = await res.text()
  if (!res.ok) throw new Error(`Meta pages fetch failed: ${text}`)
  const data = parseJsonSafe(text) as {
    data?: MetaPage[]
  }
  if (!data.data || data.data.length === 0) throw new Error("No Facebook pages found for this account")
  return data.data
}

async function getMetaInstagramBusinessAccount(pageId: string, accessToken: string) {
  const res = await fetch(
    `https://graph.facebook.com/v19.0/${pageId}?fields=instagram_business_account&access_token=${encodeURIComponent(accessToken)}`
  )
  const text = await res.text()
  if (!res.ok) throw new Error(`Meta page lookup failed: ${text}`)
  const data = parseJsonSafe(text) as { instagram_business_account?: { id?: string } }
  return data.instagram_business_account?.id ?? null
}

async function getInstagramProfile(igId: string, accessToken: string) {
  const res = await fetch(
    `https://graph.facebook.com/v19.0/${igId}?fields=username&access_token=${encodeURIComponent(accessToken)}`
  )
  const text = await res.text()
  if (!res.ok) throw new Error(`Instagram profile fetch failed: ${text}`)
  return parseJsonSafe(text) as { username?: string }
}

export async function upsertSocialConnection(params: {
  userId: string
  platform: SocialPlatform
  platformUserId: string
  platformUsername: string | null
  accessToken: string
  refreshToken?: string | null
  expiresIn?: number | null
  metaPageId?: string | null
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
        meta_page_id: params.metaPageId ?? null,
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
        metaPageId: page.id,
      })
      return
    }

    let matchedPage: MetaPage | null = null
    let igId: string | null = null
    for (const page of pages) {
      const maybeIgId = await getMetaInstagramBusinessAccount(page.id, page.access_token)
      if (maybeIgId) {
        matchedPage = page
        igId = maybeIgId
        break
      }
    }

    if (!matchedPage || !igId) {
      throw new Error("No Instagram Business account linked to your Facebook pages")
    }

    const igData = await getInstagramProfile(igId, matchedPage.access_token)

    await upsertSocialConnection({
      userId: args.userId,
      platform: "instagram",
      platformUserId: igId,
      platformUsername: igData.username ?? null,
      accessToken: matchedPage.access_token,
      refreshToken: null,
      expiresIn: tokens.expiresIn,
      metaPageId: matchedPage.id,
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
  const res = await fetch(`https://graph.facebook.com/v19.0/${connection.platform_user_id}/feed`, {
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
  if (!post.image_url && !post.video_url) {
    throw new Error("Instagram publish requires an image_url or video_url")
  }

  const caption = `${post.caption}\n\n${(post.hashtags ?? []).map((h) => `#${h}`).join(" ")}`.trim()
  const isVideoPost = Boolean(post.video_url)

  const createParams = new URLSearchParams({
    caption,
    access_token: connection.access_token,
  })

  if (isVideoPost) {
    createParams.set("media_type", "REELS")
    createParams.set("video_url", post.video_url!)
    createParams.set("share_to_feed", "true")
  } else {
    createParams.set("image_url", post.image_url!)
  }

  const createRes = await fetch(`https://graph.facebook.com/v19.0/${connection.platform_user_id}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: createParams.toString(),
  })

  const createRaw = await createRes.text()
  if (!createRes.ok) throw new Error(`Instagram media create failed: ${createRaw}`)
  const createData = parseJsonSafe(createRaw) as { id?: string }
  if (!createData.id) throw new Error("Instagram media create failed: missing container id")

  if (isVideoPost) {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const statusRes = await fetch(
        `https://graph.facebook.com/v19.0/${createData.id}?fields=status_code,status&access_token=${encodeURIComponent(connection.access_token)}`
      )
      const statusRaw = await statusRes.text()
      if (!statusRes.ok) {
        throw new Error(`Instagram container status failed: ${statusRaw}`)
      }

      const statusData = parseJsonSafe(statusRaw) as { status_code?: string; status?: string }
      const statusCode = statusData.status_code ?? statusData.status ?? ""

      if (statusCode === "FINISHED" || statusCode === "PUBLISHED") break
      if (statusCode === "ERROR" || statusCode === "EXPIRED") {
        throw new Error(`Instagram media processing failed: ${statusRaw}`)
      }

      if (attempt === 9) {
        throw new Error("Instagram media processing timed out before publish")
      }

      await wait(3000)
    }
  }

  const publishParams = new URLSearchParams({
    creation_id: createData.id,
    access_token: connection.access_token,
  })
  const publishRes = await fetch(`https://graph.facebook.com/v19.0/${connection.platform_user_id}/media_publish`, {
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
