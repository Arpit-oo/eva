import Replicate from "replicate"

const DEFAULT_VIDEO_MODEL = process.env.REPLICATE_VIDEO_MODEL ?? "bytedance/seedance-1-lite"
type ReplicateModelRef = `${string}/${string}` | `${string}/${string}:${string}`

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
})

function extractVideoUrl(output: unknown): string | null {
  const candidate = Array.isArray(output) ? output[0] : output

  if (!candidate) return null

  if (typeof candidate === "string") {
    return candidate
  }

  if (typeof candidate === "object") {
    if ("url" in candidate && typeof candidate.url === "function") {
      const value = candidate.url()
      return value instanceof URL ? value.toString() : String(value)
    }

    if ("href" in candidate && typeof candidate.href === "string") {
      return candidate.href
    }

    if ("toString" in candidate && typeof candidate.toString === "function") {
      const value = candidate.toString()
      return value && value !== "[object Object]" ? value : null
    }
  }

  return null
}

export async function generateVideo(prompt: string): Promise<string> {
  if (!process.env.REPLICATE_API_TOKEN) {
    throw new Error("REPLICATE_API_TOKEN is not configured")
  }

  const trimmedPrompt = prompt.trim()
  if (!trimmedPrompt) {
    throw new Error("prompt is required")
  }

  const modelRef = DEFAULT_VIDEO_MODEL as ReplicateModelRef

  const output = await replicate.run(modelRef, {
    input: {
      prompt: trimmedPrompt,
    },
  })

  const videoUrl = extractVideoUrl(output)
  if (!videoUrl) {
    throw new Error("Replicate returned no video URL")
  }

  return videoUrl
}