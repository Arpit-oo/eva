import { NextResponse } from "next/server"

export async function POST() {
  return NextResponse.json(
    {
      error:
        "Server-side Gemini image generation has been disabled for MVP. Use Puter.js client-side image generation via the post editor or post generation flow.",
    },
    { status: 410 }
  )
}
