import { NextResponse } from "next/server"
import { waitUntil } from "@vercel/functions"
import { createClient } from "@supabase/supabase-js"
import OpenAI from "openai"
import type { StrategyJson } from "@/lib/types"
import type { PostRow, SocialConnectionRow } from "@/lib/types"
import { publishPostToPlatform } from "@/lib/social"

// Allow up to 60s on Vercel Pro for /generate_week
export const maxDuration = 60

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

// ─── Supabase admin client (bypasses RLS) ────────────────────────────────────
function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

// ─── Telegram helpers ─────────────────────────────────────────────────────────
async function sendMessage(chatId: number, text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) return
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown" }),
  })
}

// ─── Monday of current week (ISO date) ───────────────────────────────────────
function getCurrentMonday(): string {
  const now = new Date()
  const day = now.getDay()
  const diff = now.getDate() - day + (day === 0 ? -6 : 1)
  return new Date(now.setDate(diff)).toISOString().split("T")[0]
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00")
  d.setDate(d.getDate() + days)
  return d.toISOString().split("T")[0]
}

const DAY_OFFSET: Record<string, number> = {
  Monday: 0, Tuesday: 1, Wednesday: 2, Thursday: 3,
  Friday: 4, Saturday: 5, Sunday: 6,
}
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

function toSortableDateTime(post: PostRow): number {
  if (!post.scheduled_date) return Number.MAX_SAFE_INTEGER
  const time = post.scheduled_time ?? "23:59"
  return new Date(`${post.scheduled_date}T${time}`).getTime()
}

function formatPostPreview(post: PostRow) {
  const caption = (post.caption ?? "(no caption)").replace(/\n+/g, " ")
  return caption.length > 70 ? `${caption.slice(0, 70)}...` : caption
}

async function loadCandidatePosts(userId: string, statuses: Array<PostRow["status"]>) {
  const supabase = adminClient()
  const { data, error } = await supabase
    .from("Posts")
    .select("*")
    .eq("user_id", userId)
    .in("status", statuses)

  if (error) throw new Error("Failed to load posts")
  return (data ?? []) as PostRow[]
}

function findPostByPrefix(posts: PostRow[], idOrPrefix: string) {
  const token = idOrPrefix.trim().toLowerCase()
  const matches = posts.filter((p) => p.id.toLowerCase() === token || p.id.toLowerCase().startsWith(token))

  if (matches.length === 0) throw new Error("Post ID not found. Run `/posts` to get valid IDs.")
  if (matches.length > 1) throw new Error("That short ID matches multiple posts. Please use more characters.")
  return matches[0]
}

async function handleListPostsByFilter(
  chatId: number,
  userId: string,
  options: {
    title: string
    limit?: number
    statuses?: Array<PostRow["status"]>
    platform?: PostRow["platform"]
  }
) {
  try {
    const limit = Math.min(Math.max(options.limit ?? 8, 1), 20)
    let posts = await loadCandidatePosts(userId, options.statuses ?? ["draft", "scheduled"])

    if (options.platform) {
      posts = posts.filter((post) => post.platform === options.platform)
    }

    posts = posts.sort((a, b) => toSortableDateTime(a) - toSortableDateTime(b)).slice(0, limit)

    if (posts.length === 0) {
      await sendMessage(chatId, `📭 No matching posts found for ${options.title.toLowerCase()}.`)
      return
    }

    const lines = posts.map((post) => {
      const shortId = post.id.slice(0, 8)
      const when = post.scheduled_date
        ? `${post.scheduled_date}${post.scheduled_time ? ` ${post.scheduled_time}` : ""}`
        : "unscheduled"
      return `• \`${shortId}\` | ${post.platform} | ${post.status} | ${when}\n  ${formatPostPreview(post)}`
    })

    await sendMessage(chatId, `📝 *${options.title}*\n\n${lines.join("\n\n")}`)
  } catch {
    await sendMessage(chatId, "❌ Failed to load posts. Please try again.")
  }
}

async function handlePostDetails(chatId: number, userId: string, idOrPrefix: string) {
  if (!idOrPrefix.trim()) {
    await sendMessage(chatId, "❌ Usage: `/post <post_id>`")
    return
  }

  try {
    const posts = await loadCandidatePosts(userId, ["draft", "scheduled", "published", "failed"])
    const post = findPostByPrefix(posts, idOrPrefix)
    const hashtags = (post.hashtags ?? []).slice(0, 8).map((tag) => `#${tag}`).join(" ") || "-"
    const when = post.scheduled_date
      ? `${post.scheduled_date}${post.scheduled_time ? ` ${post.scheduled_time}` : ""}`
      : "unscheduled"

    await sendMessage(
      chatId,
      `📄 *Post details*\n\nID: \`${post.id.slice(0, 8)}\`\nPlatform: *${post.platform}*\nStatus: *${post.status}*\nWhen: ${when}\n\n${formatPostPreview(post)}\n\nHashtags: ${hashtags}`
    )
  } catch (err) {
    await sendMessage(chatId, err instanceof Error ? `❌ ${err.message}` : "❌ Failed to load post details.")
  }
}

async function handlePlatformPublish(chatId: number, userId: string, idOrPrefix: string, platform: PostRow["platform"]) {
  if (!idOrPrefix.trim()) {
    await sendMessage(chatId, `❌ Usage: \/publish_${platform} <post_id>`)
    return
  }

  try {
    const posts = await loadCandidatePosts(userId, ["draft", "scheduled", "failed"])
    const post = findPostByPrefix(posts.filter((entry) => entry.platform === platform), idOrPrefix)
    await handlePublishPost(chatId, userId, post.id)
  } catch (err) {
    await sendMessage(chatId, err instanceof Error ? `❌ ${err.message}` : "❌ Publish failed.")
  }
}

async function handleStatus(chatId: number, userId: string) {
  const supabase = adminClient()
  const [{ data: posts }, { data: strategies }, { data: connections }] = await Promise.all([
    supabase.from("Posts").select("status, scheduled_date").eq("user_id", userId),
    supabase.from("Strategies").select("week_start").eq("user_id", userId).order("created_at", { ascending: false }).limit(1),
    supabase.from("SocialConnections").select("platform, status").eq("user_id", userId),
  ])

  const postRows = posts ?? []
  const scheduled = postRows.filter((post) => post.status === "scheduled").length
  const drafts = postRows.filter((post) => post.status === "draft").length
  const published = postRows.filter((post) => post.status === "published").length
  const failed = postRows.filter((post) => post.status === "failed").length
  const connectedPlatforms = (connections ?? []).filter((connection) => connection.status === "active")
  const latestStrategy = strategies?.[0]?.week_start ?? "none"

  await sendMessage(
    chatId,
    `📊 *EVA Status*\n\nDrafts: *${drafts}*\nScheduled: *${scheduled}*\nPublished: *${published}*\nFailed: *${failed}*\nConnected platforms: *${connectedPlatforms.length}*\nLatest strategy week: *${latestStrategy}*`
  )
}

async function handleToday(chatId: number, userId: string) {
  const supabase = adminClient()
  const today = new Date().toISOString().split("T")[0]

  const { data, error } = await supabase
    .from("Posts")
    .select("*")
    .eq("user_id", userId)
    .eq("scheduled_date", today)

  if (error) {
    await sendMessage(chatId, "❌ Failed to load today's posts.")
    return
  }

  const posts = ((data ?? []) as PostRow[]).sort((a, b) => toSortableDateTime(a) - toSortableDateTime(b))

  if (posts.length === 0) {
    await sendMessage(chatId, "📭 No posts scheduled for today.")
    return
  }

  const lines = posts.map((post) => {
    const time = post.scheduled_time ?? "unscheduled time"
    return `• ${time} | *${post.platform}* | ${post.status}\n  ${formatPostPreview(post)}`
  })

  await sendMessage(chatId, `🗓️ *Today's posts*\n\n${lines.join("\n\n")}`)
}

async function handleProfile(chatId: number, userId: string) {
  const supabase = adminClient()
  const { data: userData } = await supabase
    .from("Users")
    .select("active_brand_profile_id")
    .eq("id", userId)
    .single()

  if (!userData?.active_brand_profile_id) {
    await sendMessage(chatId, "📌 No active brand profile set. Open EVA Settings and choose one.")
    return
  }

  const { data: profile, error } = await supabase
    .from("BrandProfiles")
    .select("brand_name, industry, tone, audience, posting_frequency, platforms")
    .eq("id", userData.active_brand_profile_id)
    .single()

  if (error || !profile) {
    await sendMessage(chatId, "❌ Failed to load active brand profile.")
    return
  }

  const platforms = Array.isArray(profile.platforms) ? profile.platforms.join(", ") : "none"
  await sendMessage(
    chatId,
    `🏷️ *Active Profile*\n\nName: *${profile.brand_name}*\nIndustry: ${profile.industry ?? "-"}\nTone: ${profile.tone ?? "-"}\nFrequency: ${profile.posting_frequency ?? "-"}\nPlatforms: ${platforms}\nAudience: ${profile.audience ? String(profile.audience).slice(0, 120) : "-"}`
  )
}

async function handleConnections(chatId: number, userId: string) {
  const supabase = adminClient()
  const { data, error } = await supabase
    .from("SocialConnections")
    .select("platform, platform_username, status")
    .eq("user_id", userId)

  if (error) {
    await sendMessage(chatId, "❌ Failed to load connected platforms.")
    return
  }

  const connections = data ?? []
  if (connections.length === 0) {
    await sendMessage(chatId, "🔌 No social accounts connected yet. Connect them in EVA Settings.")
    return
  }

  const lines = connections.map((connection) => {
    const handle = connection.platform_username ? ` as ${connection.platform_username}` : ""
    return `• *${connection.platform}*${handle} (${connection.status})`
  })

  await sendMessage(chatId, `🔗 *Connected platforms*\n\n${lines.join("\n")}`)
}

async function handleListPosts(chatId: number, userId: string, requestedLimit = 8) {
  await handleListPostsByFilter(chatId, userId, {
    title: `Your next ${Math.min(Math.max(requestedLimit, 1), 20)} posts`,
    limit: requestedLimit,
    statuses: ["draft", "scheduled"],
  })
  await sendMessage(chatId, "Use `/publish <id>` with one of the IDs above.")
}

async function handlePublishPost(chatId: number, userId: string, idOrPrefix: string) {
  const supabase = adminClient()
  const token = idOrPrefix.trim().toLowerCase()

  if (!token) {
    await sendMessage(chatId, "❌ Usage: `/publish <post_id>`\nTip: run `/posts` to see IDs.")
    return
  }

  let post: PostRow
  try {
    const candidates = await loadCandidatePosts(userId, ["draft", "scheduled", "failed"])
    post = findPostByPrefix(candidates, token)
  } catch (err) {
    await sendMessage(chatId, err instanceof Error ? `❌ ${err.message}` : "❌ Failed to load posts. Please try again.")
    return
  }

  if (post.platform === "twitter") {
    await sendMessage(chatId, "❌ Direct publishing to Twitter/X is disabled in MVP.")
    return
  }

  const { data: connection, error: connErr } = await supabase
    .from("SocialConnections")
    .select("*")
    .eq("user_id", userId)
    .eq("platform", post.platform)
    .single()

  if (connErr || !connection) {
    await sendMessage(chatId, `❌ No ${post.platform} account connected in EVA Settings.`)
    await supabase
      .from("Posts")
      .update({ status: "failed", publish_error: `No ${post.platform} account connected` })
      .eq("id", post.id)
    return
  }

  await sendMessage(chatId, `🚀 Publishing \`${post.id.slice(0, 8)}\` to *${post.platform}*...`)

  try {
    const platformPostId = await publishPostToPlatform(post, connection as SocialConnectionRow)

    await supabase
      .from("Posts")
      .update({
        status: "published",
        platform_post_id: platformPostId,
        publish_error: null,
        published_at: new Date().toISOString(),
      })
      .eq("id", post.id)

    await sendMessage(
      chatId,
      `✅ Published successfully!\n\nPlatform: *${post.platform}*\nPost ID: \`${post.id.slice(0, 8)}\`\nRemote ID: \`${platformPostId}\``
    )
  } catch (err) {
    const message = err instanceof Error ? err.message.slice(0, 800) : "Publish failed"
    await supabase
      .from("Posts")
      .update({ status: "failed", publish_error: message })
      .eq("id", post.id)

    await sendMessage(chatId, `❌ Publish failed:\n\n${message}`)
  }
}

// ─── Command handlers ─────────────────────────────────────────────────────────

async function handleStart(chatId: number, token: string) {
  const supabase = adminClient()
  const clean = token.trim()
  if (!clean) {
    await sendMessage(chatId, "❌ Usage: `/start <your-link-token>`\n\nFind your token in EVA › Settings › Telegram Integration.")
    return
  }

  const { data: user, error } = await supabase
    .from("Users")
    .select("id, telegram_chat_id")
    .eq("telegram_link_token", clean)
    .single()

  if (error || !user) {
    await sendMessage(chatId, "❌ Token not found. Make sure you copied it correctly from EVA Settings.")
    return
  }

  if (user.telegram_chat_id) {
    await sendMessage(chatId, "✅ This account is already linked to Telegram!")
    return
  }

  await supabase
    .from("Users")
    .update({ telegram_chat_id: String(chatId) })
    .eq("id", user.id)

  await sendMessage(chatId, "🎉 *Account linked!*\n\nYou can now use:\n• `/capture_idea <your idea>` — save an idea\n• `/generate_week` — generate this week's content plan\n• `/posts` — list draft and scheduled posts\n• `/status` — quick account snapshot")
}

async function handleCaptureIdea(chatId: number, userId: string, ideaText: string) {
  const supabase = adminClient()

  // Save the idea
  const { error } = await supabase
    .from("Ideas")
    .insert({ user_id: userId, idea_text: ideaText.trim() })

  if (error) {
    await sendMessage(chatId, "❌ Failed to save your idea. Please try again.")
    return
  }

  await sendMessage(chatId, `✅ *Idea saved!*\n\n_"${ideaText.slice(0, 100)}${ideaText.length > 100 ? "..." : ""}"_\n\n🤖 Drafting a quick post...`)

  // Draft a post based on the idea
  try {
    const { data: userData } = await supabase
      .from("Users")
      .select("active_brand_profile_id")
      .eq("id", userId)
      .single()

    if (!userData?.active_brand_profile_id) {
      await sendMessage(chatId, "💡 Idea saved! Set an active brand profile in EVA to enable auto-drafting.")
      return
    }

    const { data: profile } = await supabase
      .from("BrandProfiles")
      .select("*")
      .eq("id", userData.active_brand_profile_id)
      .single()

    if (!profile) {
      await sendMessage(chatId, "💡 Idea saved! Could not find your brand profile for drafting.")
      return
    }

    const platform = ((profile.platforms as string[])?.[0] ?? "LinkedIn").toLowerCase()

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You are a social media copywriter. Generate a single ${platform} post based on the user's idea and brand voice.
Respond ONLY with this JSON shape:
{"caption": "string", "hashtags": ["string"], "image_prompt": "string"}`,
        },
        {
          role: "user",
          content: `Brand: ${profile.brand_name}
Tone: ${profile.tone}
Audience: ${profile.audience}
Platform: ${platform}

Idea: ${ideaText}

Write a compelling ${platform} post for this idea.`,
        },
      ],
    })

    const parsed = JSON.parse(completion.choices[0].message.content ?? "{}")

    await supabase.from("Posts").insert({
      user_id: userId,
      platform,
      caption: parsed.caption ?? ideaText,
      hashtags: parsed.hashtags ?? [],
      image_prompt: parsed.image_prompt ?? null,
      status: "draft",
    })

    const hashtagStr = (parsed.hashtags as string[] ?? [])
      .slice(0, 5)
      .map((h: string) => `#${h}`)
      .join(" ")

    await sendMessage(
      chatId,
      `✏️ *Draft created for ${platform}:*\n\n${parsed.caption}\n\n${hashtagStr}\n\n_Open EVA to review, edit, and schedule it._`
    )
  } catch (err) {
    console.error("Idea draft failed:", err)
    await sendMessage(chatId, "💡 Idea saved! Head to EVA to turn it into a post.")
  }
}

async function handleGenerateWeek(chatId: number, userId: string) {
  const supabase = adminClient()

  await sendMessage(chatId, "⏳ *Generating your weekly content plan...*\n\nThis usually takes 15–30 seconds.")

  try {
    // Resolve active brand profile
    const { data: userData } = await supabase
      .from("Users")
      .select("active_brand_profile_id")
      .eq("id", userId)
      .single()

    if (!userData?.active_brand_profile_id) {
      await sendMessage(chatId, "❌ No active brand profile. Set one in EVA › Settings first.")
      return
    }

    const { data: profile } = await supabase
      .from("BrandProfiles")
      .select("*")
      .eq("id", userData.active_brand_profile_id)
      .single()

    if (!profile) {
      await sendMessage(chatId, "❌ Brand profile not found. Please check EVA › Settings.")
      return
    }

    // ── Step 1: Generate strategy ────────────────────────────────────────────
    const strategyCompletion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      temperature: 0.8,
      messages: [
        {
          role: "system",
          content: `You are a social media content strategist. Generate a 7-day content strategy.
Respond ONLY with this exact JSON (no markdown):
{
  "week_theme": "string",
  "days": [
    {"day_of_week": "Monday","content_type": "string","theme": "string","target_emotion": "string"}
  ]
}
The days array must have exactly 7 entries, Monday–Sunday in order.`,
        },
        {
          role: "user",
          content: `Brand: ${profile.brand_name}
Industry: ${profile.industry}
Tone: ${profile.tone}
Audience: ${profile.audience}
Keywords: ${(profile.keywords as string[]).join(", ")}
Platforms: ${(profile.platforms as string[]).join(", ")}
Frequency: ${profile.posting_frequency}

Generate a compelling 7-day content strategy.`,
        },
      ],
    })

    const rawStrategy = JSON.parse(strategyCompletion.choices[0].message.content ?? "{}")
    if (!rawStrategy.week_theme || !Array.isArray(rawStrategy.days) || rawStrategy.days.length !== 7) {
      throw new Error("Invalid strategy shape")
    }

    const strategyJson: StrategyJson = {
      week_theme: String(rawStrategy.week_theme),
      days: DAYS.map((day, i) => ({
        day_of_week: day,
        content_type: String(rawStrategy.days[i]?.content_type ?? "Educational"),
        theme: String(rawStrategy.days[i]?.theme ?? ""),
        target_emotion: String(rawStrategy.days[i]?.target_emotion ?? "Inspired"),
      })),
    }

    const weekStart = getCurrentMonday()

    const { data: strategy, error: stratInsertErr } = await supabase
      .from("Strategies")
      .insert({ user_id: userId, brand_profile_id: profile.id, week_start: weekStart, strategy_json: strategyJson })
      .select()
      .single()

    if (stratInsertErr || !strategy) throw new Error(stratInsertErr?.message ?? "Strategy insert failed")

    // ── Step 2: Generate posts for all 7 days in parallel ────────────────────
    const platforms = (profile.platforms as string[]) ?? ["LinkedIn"]
    const weekEnd = addDays(weekStart, 6)

    await supabase.from("Posts").delete()
      .eq("user_id", userId)
      .gte("scheduled_date", weekStart)
      .lte("scheduled_date", weekEnd)

    const dayResults = await Promise.allSettled(
      strategyJson.days.map(async (day) => {
        const scheduledDate = addDays(weekStart, DAY_OFFSET[day.day_of_week] ?? 0)
        const completion = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          response_format: { type: "json_object" },
          temperature: 0.75,
          messages: [
            {
              role: "system",
              content: `You are a social media copywriter. Write platform-specific posts.
Respond ONLY with this JSON:
{"posts": [{"platform": "string","caption": "string","hashtags": ["string"],"image_prompt": "string","best_posting_time": "HH:MM"}]}
One post per platform.`,
            },
            {
              role: "user",
              content: `Brand: ${profile.brand_name}
Industry: ${profile.industry}
Tone: ${profile.tone}
Audience: ${profile.audience}
Keywords: ${(profile.keywords as string[]).join(", ")}
Platforms: ${platforms.join(", ")}

Week Theme: "${strategyJson.week_theme}"
Day: ${day.day_of_week} | Type: ${day.content_type} | Theme: "${day.theme}" | Emotion: ${day.target_emotion}

Write one post per platform.`,
            },
          ],
        })
        const parsed = JSON.parse(completion.choices[0].message.content ?? "{}") as { posts: { platform: string; caption: string; hashtags: string[]; image_prompt: string; best_posting_time: string }[] }
        return { scheduledDate, posts: parsed.posts ?? [] }
      })
    )

    const toInsert: object[] = []
    for (const result of dayResults) {
      if (result.status === "rejected") continue
      for (const p of result.value.posts) {
        toInsert.push({
          user_id: userId,
          platform: p.platform.toLowerCase(),
          caption: p.caption,
          hashtags: p.hashtags ?? [],
          image_prompt: p.image_prompt ?? null,
          scheduled_date: result.value.scheduledDate,
          scheduled_time: p.best_posting_time ?? null,
          status: "draft",
        })
      }
    }

    if (toInsert.length > 0) {
      await supabase.from("Posts").insert(toInsert)
    }

    const postCount = toInsert.length
    const dayLines = strategyJson.days
      .map((d) => `• *${d.day_of_week}:* ${d.content_type} — ${d.theme}`)
      .join("\n")

    await sendMessage(
      chatId,
      `✅ *Week generated!* ${postCount} posts drafted.\n\n*Theme:* ${strategyJson.week_theme}\n\n${dayLines}\n\n_Open EVA › Calendar to review and schedule your posts._`
    )
  } catch (err) {
    console.error("generate_week failed:", err)
    await sendMessage(chatId, "❌ Generation failed. Please try again or use EVA on the web.")
  }
}

// ─── Main webhook handler ─────────────────────────────────────────────────────

export async function GET() {
  return NextResponse.json({ ok: true, service: "telegram-webhook", method: "POST" })
}

export async function POST(request: Request) {
  let body: {
    message?: {
      message_id: number
      chat: { id: number }
      from?: { id: number }
      text?: string
    }
  }

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: true })
  }

  const message = body?.message
  if (!message?.text || !message.chat?.id) {
    return NextResponse.json({ ok: true })
  }

  const chatId = message.chat.id
  const text = message.text.trim()

  // ── /start <token> ───────────────────────────────────────────────────────────
  if (text.startsWith("/start")) {
    const token = text.replace("/start", "").trim()
    waitUntil(handleStart(chatId, token))
    return NextResponse.json({ ok: true })
  }

  // All other commands require a linked account
  const supabase = adminClient()
  const { data: user } = await supabase
    .from("Users")
    .select("id")
    .eq("telegram_chat_id", String(chatId))
    .single()

  if (!user) {
    await sendMessage(chatId, "⚠️ Account not linked. Send `/start <your-token>` to connect your EVA account.")
    return NextResponse.json({ ok: true })
  }

  // ── /capture_idea <text> ─────────────────────────────────────────────────────
  if (text.startsWith("/capture_idea")) {
    const ideaText = text.replace("/capture_idea", "").trim()
    if (!ideaText) {
      await sendMessage(chatId, "❌ Usage: `/capture_idea <your idea text>`")
      return NextResponse.json({ ok: true })
    }
    waitUntil(handleCaptureIdea(chatId, user.id, ideaText))
    return NextResponse.json({ ok: true })
  }

  // ── /generate_week ───────────────────────────────────────────────────────────
  if (text.startsWith("/generate_week")) {
    waitUntil(handleGenerateWeek(chatId, user.id))
    return NextResponse.json({ ok: true })
  }

  // ── /posts [limit] ───────────────────────────────────────────────────────────
  if (text.startsWith("/posts")) {
    const maybeLimit = Number(text.replace("/posts", "").trim())
    const limit = Number.isFinite(maybeLimit) ? maybeLimit : 8
    waitUntil(handleListPosts(chatId, user.id, limit))
    return NextResponse.json({ ok: true })
  }

  // ── /drafts [limit] ─────────────────────────────────────────────────────────
  if (text.startsWith("/drafts")) {
    const maybeLimit = Number(text.replace("/drafts", "").trim())
    const limit = Number.isFinite(maybeLimit) ? maybeLimit : 8
    waitUntil(handleListPostsByFilter(chatId, user.id, { title: "Draft posts", limit, statuses: ["draft"] }))
    return NextResponse.json({ ok: true })
  }

  // ── /failed [limit] ─────────────────────────────────────────────────────────
  if (text.startsWith("/failed")) {
    const maybeLimit = Number(text.replace("/failed", "").trim())
    const limit = Number.isFinite(maybeLimit) ? maybeLimit : 8
    waitUntil(handleListPostsByFilter(chatId, user.id, { title: "Failed posts", limit, statuses: ["failed"] }))
    return NextResponse.json({ ok: true })
  }

  // ── /linkedin_posts [limit] ────────────────────────────────────────────────
  if (text.startsWith("/linkedin_posts")) {
    const maybeLimit = Number(text.replace("/linkedin_posts", "").trim())
    const limit = Number.isFinite(maybeLimit) ? maybeLimit : 8
    waitUntil(handleListPostsByFilter(chatId, user.id, { title: "LinkedIn posts", limit, statuses: ["draft", "scheduled", "failed"], platform: "linkedin" }))
    return NextResponse.json({ ok: true })
  }

  // ── /post <post_id> ────────────────────────────────────────────────────────
  if (text.startsWith("/post")) {
    const idOrPrefix = text.replace("/post", "").trim()
    waitUntil(handlePostDetails(chatId, user.id, idOrPrefix))
    return NextResponse.json({ ok: true })
  }

  // ── /today ──────────────────────────────────────────────────────────────────
  if (text.startsWith("/today")) {
    waitUntil(handleToday(chatId, user.id))
    return NextResponse.json({ ok: true })
  }

  // ── /status ─────────────────────────────────────────────────────────────────
  if (text.startsWith("/status")) {
    waitUntil(handleStatus(chatId, user.id))
    return NextResponse.json({ ok: true })
  }

  // ── /profile ────────────────────────────────────────────────────────────────
  if (text.startsWith("/profile")) {
    waitUntil(handleProfile(chatId, user.id))
    return NextResponse.json({ ok: true })
  }

  // ── /connections ────────────────────────────────────────────────────────────
  if (text.startsWith("/connections")) {
    waitUntil(handleConnections(chatId, user.id))
    return NextResponse.json({ ok: true })
  }

  // ── /publish <post_id> ───────────────────────────────────────────────────────
  if (text.startsWith("/publish")) {
    const idOrPrefix = text.replace("/publish", "").trim()
    waitUntil(handlePublishPost(chatId, user.id, idOrPrefix))
    return NextResponse.json({ ok: true })
  }

  // ── /publish_linkedin <post_id> ────────────────────────────────────────────
  if (text.startsWith("/publish_linkedin")) {
    const idOrPrefix = text.replace("/publish_linkedin", "").trim()
    waitUntil(handlePlatformPublish(chatId, user.id, idOrPrefix, "linkedin"))
    return NextResponse.json({ ok: true })
  }

  // ── /help or unknown ─────────────────────────────────────────────────────────
  await sendMessage(
    chatId,
    "🤖 *EVA Content Bot*\n\nAvailable commands:\n• `/capture_idea <text>` — save an idea & draft a post\n• `/generate_week` — generate this week's full content plan\n• `/posts [limit]` — list your draft/scheduled posts\n• `/drafts [limit]` — list only draft posts\n• `/failed [limit]` — list failed posts\n• `/linkedin_posts [limit]` — list LinkedIn-ready posts\n• `/post <post_id>` — show details for one post\n• `/publish <post_id>` — publish one post now\n• `/publish_linkedin <post_id>` — publish one LinkedIn post now\n• `/today` — show today's scheduled posts\n• `/status` — account and content summary\n• `/profile` — show your active brand profile\n• `/connections` — list connected social platforms\n• `/start <token>` — link your EVA account"
  )
  return NextResponse.json({ ok: true })
}
