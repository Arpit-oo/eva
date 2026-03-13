import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import OpenAI from "openai"

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

function parseEvaluationPayload(raw: string) {
  const trimmed = raw.trim()

  const attempts: string[] = [trimmed]
  if (trimmed.startsWith("```") && trimmed.endsWith("```")) {
    attempts.push(trimmed.replace(/^```[a-zA-Z]*\s*/, "").replace(/```$/, "").trim())
  }

  const firstBrace = trimmed.indexOf("{")
  const lastBrace = trimmed.lastIndexOf("}")
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    attempts.push(trimmed.slice(firstBrace, lastBrace + 1))
  }

  for (const candidate of attempts) {
    try {
      const parsed = JSON.parse(candidate) as {
        score?: number
        strengths?: string[]
        suggestions?: string[]
        improved_caption?: string
      }
      const normalizedScore = Number.isFinite(Number(parsed.score))
        ? Math.max(1, Math.min(10, Number(parsed.score)))
        : 5

      return {
        score: normalizedScore,
        strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
        suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
        improved_caption:
          typeof parsed.improved_caption === "string" && parsed.improved_caption.trim().length > 0
            ? parsed.improved_caption
            : "",
      }
    } catch {
      // Try next candidate shape.
    }
  }

  throw new Error("Failed to parse AI response")
}

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
  "score": <number 1-10 with up to one decimal place>,
  "strengths": [<string>, ...],
  "suggestions": [<string>, ...],
  "improved_caption": <string>
}

Use the full score range and avoid defaulting to 7 unless it genuinely fits.`,
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
    const raw = completion.choices[0].message.content ?? "{}"
    const evaluation = parseEvaluationPayload(raw)
    return NextResponse.json({ evaluation })
  } catch {
    return NextResponse.json({ error: "Failed to parse AI response" }, { status: 500 })
  }
}
