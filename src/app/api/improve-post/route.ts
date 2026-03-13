import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import OpenAI from "openai"

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { caption, platform, hashtags } = (await request.json()) as {
    caption: string
    platform: string
    hashtags?: string[]
  }

  if (!caption?.trim()) {
    return NextResponse.json({ error: "caption is required" }, { status: 400 })
  }

  // Fetch brand profile for context
  const { data: brand } = await supabase
    .from("BrandProfiles")
    .select("brand_name, industry, tone, audience")
    .eq("user_id", user.id)
    .single()

  const brandContext = brand
    ? `Brand: ${brand.brand_name}\nIndustry: ${brand.industry}\nTone: ${brand.tone}\nTarget Audience: ${brand.audience}\n`
    : ""

  const hashtagList = (hashtags ?? []).join(", ")

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You are an expert social media content analyst. Evaluate the provided post and return ONLY a JSON object with this exact schema:
{
  "score": <integer 1-10>,
  "strengths": [<string>, ...],
  "suggestions": [<string>, ...],
  "improved_caption": <string>
}`,
      },
      {
        role: "user",
        content: `${brandContext}Platform: ${platform}
Caption: ${caption}
${hashtagList ? `Hashtags: ${hashtagList}` : ""}

Analyze this post. Provide an honest score, list 2-3 strengths, 2-3 actionable suggestions, and a fully rewritten improved caption that addresses the suggestions while staying true to the brand voice.`,
      },
    ],
  })

  try {
    const evaluation = JSON.parse(completion.choices[0].message.content ?? "{}")
    return NextResponse.json({ evaluation })
  } catch {
    return NextResponse.json({ error: "Failed to parse AI response" }, { status: 500 })
  }
}
