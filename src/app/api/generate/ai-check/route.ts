import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import OpenAI from "openai"

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

type CheckResponse = {
  authenticity_score: number
  verdict: "likely_human" | "mixed" | "likely_ai"
  rationale: string
  suggestions: string[]
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const postId: string | undefined = body.post_id
  const fallbackCaption: string | undefined = body.caption

  if (!postId && !fallbackCaption) {
    return NextResponse.json({ error: "post_id or caption is required" }, { status: 400 })
  }

  let caption = (fallbackCaption ?? "").trim()
  let hashtags: string[] = []

  if (postId) {
    const { data: post, error } = await supabase
      .from("Posts")
      .select("caption,hashtags")
      .eq("id", postId)
      .eq("user_id", user.id)
      .single()

    if (error || !post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 })
    }

    caption = post.caption ?? caption
    hashtags = Array.isArray(post.hashtags) ? post.hashtags : []
  }

  if (!caption) {
    return NextResponse.json({ error: "No caption found for this post" }, { status: 400 })
  }

  const systemPrompt = `You are an expert social copy editor.
Evaluate whether a social media caption feels authentic and human.
Return ONLY valid JSON in this exact shape:
{
  "authenticity_score": "number 0-100 where higher = more human/authentic",
  "verdict": "likely_human | mixed | likely_ai",
  "rationale": "short plain-English explanation in 1-2 sentences",
  "suggestions": ["up to 3 concrete rewrite suggestions"]
}`

  const userPrompt = `Caption:\n${caption}\n\nHashtags: ${hashtags.join(", ") || "none"}`

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    })

    const raw = completion.choices[0]?.message?.content ?? "{}"
    const parsed = JSON.parse(raw) as Partial<CheckResponse>

    const payload: CheckResponse = {
      authenticity_score: clamp(Number(parsed.authenticity_score ?? 0), 0, 100),
      verdict:
        parsed.verdict === "likely_human" || parsed.verdict === "mixed" || parsed.verdict === "likely_ai"
          ? parsed.verdict
          : "mixed",
      rationale: String(parsed.rationale ?? "This caption is readable but could sound more personal."),
      suggestions: Array.isArray(parsed.suggestions)
        ? parsed.suggestions.slice(0, 3).map((item) => String(item))
        : [],
    }

    return NextResponse.json(payload, { status: 200 })
  } catch (err: unknown) {
    console.error("AI checker failed:", err)
    return NextResponse.json({ error: "AI checker failed" }, { status: 500 })
  }
}
