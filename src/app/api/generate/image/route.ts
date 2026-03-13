import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { GoogleGenAI } from "@google/genai"

const DEFAULT_MODEL_ID = "gemini-2.5-flash-image"

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  if (!process.env.GOOGLE_AI_API_KEY) {
    return NextResponse.json({ error: "GOOGLE_AI_API_KEY is not configured" }, { status: 500 })
  }

  const { prompt, post_id, model } = (await request.json()) as {
    prompt: string
    post_id?: string
    model?: string
  }
  if (!prompt) return NextResponse.json({ error: "prompt is required" }, { status: 400 })

  const selectedModel = model?.trim() || DEFAULT_MODEL_ID
  if (selectedModel !== DEFAULT_MODEL_ID) {
    return NextResponse.json({ error: `Unsupported image model: ${selectedModel}` }, { status: 400 })
  }

  const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_AI_API_KEY })

  try {
    const response = await ai.models.generateContent({
      model: selectedModel,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        responseModalities: ["Text", "Image"],
      },
    })

    const parts = response.candidates?.[0]?.content?.parts ?? []
    let imageData: string | null = null
    let mimeType = "image/png"

    for (const part of parts) {
      if ("inlineData" in part && part.inlineData) {
        imageData = part.inlineData.data ?? null
        mimeType = part.inlineData.mimeType ?? "image/png"
      }
    }

    if (!imageData) {
      console.error("No image data in Gemini response:", JSON.stringify(response).slice(0, 300))
      return NextResponse.json({ error: "No image data returned from Gemini" }, { status: 500 })
    }

    const imageUrl = `data:${mimeType};base64,${imageData}`

    if (post_id) {
      await supabase
        .from("Posts")
        .update({ image_url: imageUrl })
        .eq("id", post_id)
        .eq("user_id", user.id)
    }

    return NextResponse.json({ image_url: imageUrl })
  } catch (err: unknown) {
    console.error("Image generation failed:", err)
    const message = err instanceof Error ? err.message : "Image generation failed"
    const quotaHit = /RESOURCE_EXHAUSTED|quota|rate.?limit|CreditsDepleted/i.test(message)
    if (quotaHit) {
      return NextResponse.json(
        {
          error:
            "Image generation quota exceeded for Gemini. Please add billing/credits to GOOGLE_AI_API_KEY project or wait for quota reset, then retry.",
          model: selectedModel,
        },
        { status: 429 }
      )
    }

    return NextResponse.json({ error: message }, { status: 500 })
  }
}
