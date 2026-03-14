import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import OpenAI from "openai"
import type { GeneratedPost } from "@/lib/types"

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

// Day offsets: Monday = 0 … Sunday = 6
const DAY_OFFSET: Record<string, number> = {
  Monday: 0,
  Tuesday: 1,
  Wednesday: 2,
  Thursday: 3,
  Friday: 4,
  Saturday: 5,
  Sunday: 6,
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00")
  d.setDate(d.getDate() + days)
  return d.toISOString().split("T")[0]
}

function getStrategyMaxDayOffset(days: Array<{ day_of_week: string }>): number {
  if (!days.length) return 0
  return Math.max(...days.map((day) => DAY_OFFSET[day.day_of_week] ?? 0))
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json()
  const { strategy_id } = body as { strategy_id: string }
  if (!strategy_id) {
    return NextResponse.json({ error: "strategy_id is required" }, { status: 400 })
  }

  // Fetch strategy
  const { data: strategy, error: stratErr } = await supabase
    .from("Strategies")
    .select("*")
    .eq("id", strategy_id)
    .eq("user_id", user.id)
    .single()
  if (stratErr || !strategy) {
    return NextResponse.json({ error: "Strategy not found" }, { status: 404 })
  }

  // Fetch brand profile
  const { data: profile, error: profErr } = await supabase
    .from("BrandProfiles")
    .select("*")
    .eq("id", strategy.brand_profile_id)
    .eq("user_id", user.id)
    .single()
  if (profErr || !profile) {
    return NextResponse.json({ error: "Brand profile not found" }, { status: 404 })
  }

  const platforms: string[] = (profile.platforms as string[]) ?? ["LinkedIn"]
  const platformList = platforms.join(", ")

  const { week_theme, days } = strategy.strategy_json
  const maxDayOffset = getStrategyMaxDayOffset(days)

  // Delete existing posts for the strategy date span so regeneration is clean
  const weekEnd = addDays(strategy.week_start, maxDayOffset)
  await supabase
    .from("Posts")
    .delete()
    .eq("user_id", user.id)
    .gte("scheduled_date", strategy.week_start)
    .lte("scheduled_date", weekEnd)

  // Generate posts for all strategy days in parallel
  const dayResults = await Promise.allSettled(
    days.map(async (day: { day_of_week: string; content_type: string; theme: string; target_emotion: string }) => {
      const scheduledDate = addDays(
        strategy.week_start,
        DAY_OFFSET[day.day_of_week] ?? 0
      )

      const systemPrompt = `You are an expert social media copywriter. Given a brand profile, weekly theme, and day strategy, write platform-specific posts.
Respond with ONLY valid JSON matching this exact shape — no markdown, no explanation:
{
  "posts": [
    {
      "platform": "string (exact platform name)",
      "caption": "string (platform-appropriate caption)",
      "hashtags": ["string"],
      "image_prompt": "string (detailed prompt for the post visual)",
      "best_posting_time": "string (HH:MM 24h format)"
    }
  ]
}
Generate one post object per platform requested. Tailor caption length and tone to each platform (LinkedIn = professional/longer, Twitter = punchy/under 280 chars, Instagram = engaging/visual, Facebook = conversational).`

      const userPrompt = `Brand: ${profile.brand_name}
Industry: ${profile.industry}
Tone: ${profile.tone}
Target Audience: ${profile.audience}
Keywords: ${(profile.keywords as string[]).join(", ")}
Platforms: ${platformList}

Week Theme: "${week_theme}"
Day: ${day.day_of_week}
Content Type: ${day.content_type}
Day Theme: "${day.theme}"
Target Emotion: ${day.target_emotion}

Write one post per platform (${platformList}).`

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.75,
        response_format: { type: "json_object" },
      })

      const raw = completion.choices[0]?.message?.content ?? "{}"
      const parsed = JSON.parse(raw) as { posts: GeneratedPost[] }
      if (!Array.isArray(parsed.posts)) throw new Error("Invalid AI response shape")

      return { scheduledDate, generatedPosts: parsed.posts }
    })
  )

  // Flatten and insert posts
  const toInsert: {
    user_id: string
    platform: string
    caption: string
    hashtags: string[]
    image_prompt: string | null
    scheduled_date: string
    scheduled_time: string | null
    status: string
  }[] = []

  for (const result of dayResults) {
    if (result.status === "rejected") {
      console.error("Day post generation failed:", result.reason)
      continue
    }
    const { scheduledDate, generatedPosts } = result.value
    for (const gp of generatedPosts) {
      toInsert.push({
        user_id: user.id,
        platform: gp.platform.toLowerCase(),
        caption: gp.caption,
        hashtags: gp.hashtags ?? [],
        image_prompt: gp.image_prompt ?? null,
        scheduled_date: scheduledDate,
        scheduled_time: gp.best_posting_time ?? null,
        status: "draft",
      })
    }
  }

  if (toInsert.length === 0) {
    return NextResponse.json({ error: "All day generations failed" }, { status: 500 })
  }

  const { data: posts, error: insertErr } = await supabase
    .from("Posts")
    .insert(toInsert)
    .select()

  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 })
  }

  return NextResponse.json({ posts }, { status: 201 })
}
