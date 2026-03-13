type PostImageInput = {
  id: string
  caption: string
  image_prompt: string | null
}

function normalizeDataUrl(base64: string) {
  if (base64.startsWith("data:")) return base64
  return `data:image/png;base64,${base64}`
}

function extractImageSource(payload: unknown): string | null {
  if (!payload) return null

  if (typeof payload === "string") return payload

  if (payload instanceof HTMLImageElement) {
    return payload.src || null
  }

  if (typeof payload === "object") {
    const candidate = payload as Record<string, unknown>

    if (typeof candidate.src === "string") return candidate.src
    if (typeof candidate.url === "string") return candidate.url
    if (typeof candidate.image_url === "string") return candidate.image_url
    if (typeof candidate.base64 === "string") return normalizeDataUrl(candidate.base64)

    const data = candidate.data
    if (Array.isArray(data) && data.length > 0 && typeof data[0] === "object" && data[0] !== null) {
      const first = data[0] as Record<string, unknown>
      if (typeof first.url === "string") return first.url
      if (typeof first.b64_json === "string") return normalizeDataUrl(first.b64_json)
    }
  }

  return null
}

async function loadPuterClient() {
  const mod = await import("@heyputer/puter.js")
  return mod.default ?? mod.puter
}

export async function generateImageWithPuter(prompt: string): Promise<Blob> {
  if (typeof window === "undefined") {
    throw new Error("Puter image generation is available only in the browser")
  }

  const textPrompt = prompt.trim()
  if (!textPrompt) throw new Error("Image prompt is required")

  const puterClient = await loadPuterClient()
  const ai = (puterClient as unknown as { ai?: Record<string, unknown> }).ai
  if (!ai) throw new Error("Puter AI client is unavailable")

  let result: unknown = null

  const imageApi = (ai as { image?: { generate?: (p: string, options?: Record<string, unknown>) => Promise<unknown> } }).image
  if (imageApi?.generate) {
    result = await imageApi.generate(textPrompt, { testMode: true })
  } else {
    const txt2img = (ai as { txt2img?: (p: string, options?: Record<string, unknown>) => Promise<unknown> }).txt2img
    if (!txt2img) {
      throw new Error("Puter image API is unavailable")
    }
    result = await txt2img(textPrompt, { testMode: true })
  }

  const src = extractImageSource(result)
  if (!src) throw new Error("Puter did not return a valid image source")

  const response = await fetch(src)
  if (!response.ok) {
    throw new Error("Failed to download generated image")
  }

  return await response.blob()
}

export async function uploadGeneratedPostImage(postId: string, blob: Blob) {
  const type = blob.type || "image/png"
  const extension = type.includes("jpeg") ? "jpg" : type.split("/")[1] || "png"
  const file = new File([blob], `puter-${Date.now()}.${extension}`, { type })

  const formData = new FormData()
  formData.append("file", file)

  const res = await fetch(`/api/posts/${postId}/image-upload`, {
    method: "POST",
    body: formData,
  })

  const payload = await res.json().catch(() => ({}))
  if (!res.ok) {
    const message = typeof payload?.error === "string" ? payload.error : "Image upload failed"
    throw new Error(message)
  }

  if (!payload?.image_url || typeof payload.image_url !== "string") {
    throw new Error("Image upload succeeded but URL was missing")
  }

  return payload.image_url as string
}

export async function generateAndAttachPostImage(post: PostImageInput) {
  const prompt = post.image_prompt?.trim() || post.caption.trim().slice(0, 500)
  if (!prompt) throw new Error("No prompt available for image generation")
  const blob = await generateImageWithPuter(prompt)
  return await uploadGeneratedPostImage(post.id, blob)
}
