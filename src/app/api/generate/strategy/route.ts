import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import OpenAI from "openai"
import type { StrategyJson } from "@/lib/types"

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

function getMondayOfCurrentWeek(): string {
  const now = new Date()
  const day = now.getDay() // 0=Sun, 1=Mon...
  const diff = now.getDate() - day + (day === 0 ? -6 : 1)
  const monday = new Date(now.setDate(diff))
  return monday.toISOString().split("T")[0]
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json()
  const brandProfileId: string | undefined = body.brand_profile_id

  // Resolve brand profile — use supplied ID or fall back to active
  let profileId = brandProfileId
  if (!profileId) {
    const { data: userData } = await supabase
      .from("Users")
      .select("active_brand_profile_id")
      .eq("id", user.id)
      .single()
    profileId = userData?.active_brand_profile_id ?? undefined
  }

  if (!profileId) {
    return NextResponse.json({ error: "No brand profile selected" }, { status: 400 })
  }

  const { data: profile, error: profileError } = await supabase
    .from("BrandProfiles")
    .select("*")
    .eq("id", profileId)
    .eq("user_id", user.id)
    .single()

  if (profileError || !profile) {
    return NextResponse.json({ error: "Brand profile not found" }, { status: 404 })
  }

  // Build the prompt
  const systemPrompt = `You are a social media content strategist. Given a brand profile, generate a 7-day content strategy plan.
You MUST respond with ONLY valid JSON matching this exact shape — no markdown, no explanation, no extra keys:
{
  "week_theme": "string (overarching theme for the week, max 10 words)",
  "days": [
    {
      "day_of_week": "Monday",
      "content_type": "string (e.g. Educational, Motivational, Behind-the-Scenes, Case Study, Promotional, Engagement, Story)",
      "theme": "string (specific topic/angle for this day, max 15 words)",
      "target_emotion": "string (emotion to evoke, e.g. Inspired, Curious, Trusting, Excited, Amused)"
    }
  ]
}
The days array must contain exactly 7 entries, one for each day Monday–Sunday in order.`

  const userPrompt = `Brand Name: ${profile.brand_name}
Industry: ${profile.industry}
Tone: ${profile.tone}
Target Audience: ${profile.audience}
Posting Frequency: ${profile.posting_frequency}
Keywords: ${(profile.keywords as string[]).join(", ") || "none"}
Platforms: ${(profile.platforms as string[]).join(", ") || "all major platforms"}

Generate a compelling 7-day content strategy for this brand.`

  let strategyJson: StrategyJson

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.8,
      response_format: { type: "json_object" },
    })

    const raw = completion.choices[0]?.message?.content ?? "{}"
    const parsed = JSON.parse(raw)

    // Normalise + validate shape
    if (!parsed.week_theme || !Array.isArray(parsed.days) || parsed.days.length !== 7) {
      throw new Error("Invalid strategy shape from AI")
    }

    strategyJson = {
      week_theme: String(parsed.week_theme),
      days: DAYS.map((day, i) => ({
        day_of_week: day,
        content_type: String(parsed.days[i]?.content_type ?? "Educational"),
        theme: String(parsed.days[i]?.theme ?? ""),
        target_emotion: String(parsed.days[i]?.target_emotion ?? "Inspired"),
      })),
    }
  } catch (err: unknown) {
    console.error("OpenAI strategy generation failed:", err)
    // Surface meaningful error message to the client
    let message = "AI generation failed, please try again"
    if (err instanceof Error) {
      if (err.message.includes("429") || err.message.toLowerCase().includes("quota") || err.message.toLowerCase().includes("rate limit")) {
        message = "OpenAI API quota exceeded — please add billing credits at platform.openai.com"
      } else if (err.message.includes("401") || err.message.toLowerCase().includes("invalid api key")) {
        message = "Invalid OpenAI API key — check your OPENAI_API_KEY in .env.local"
      } else {
        message = err.message
      }
    }
    return NextResponse.json({ error: message }, { status: 500 })
  }

  // Persist to Strategies table
  const { data: strategy, error: insertError } = await supabase
    .from("Strategies")
    .insert({
      user_id: user.id,
      brand_profile_id: profileId,
      week_start: getMondayOfCurrentWeek(),
      strategy_json: strategyJson,
    })
    .select()
    .single()

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  return NextResponse.json({ strategy }, { status: 201 })
}
