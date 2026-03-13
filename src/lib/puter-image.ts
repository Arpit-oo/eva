type PuterImageGenerator = (prompt: string | { prompt: string }) => Promise<unknown>

export type PuterGeneratedImage = {
  localUrl: string
  base64Url: string
  mimeType: string
}

function imageToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result)
        return
      }
      reject(new Error("Failed to read generated image"))
    }
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read generated image"))
    reader.readAsDataURL(blob)
  })
}

async function getPuterImageGenerator(): Promise<PuterImageGenerator> {
  const puterModule = await import("@heyputer/puter.js")
  const puter = puterModule.puter ?? puterModule.default
  const ai = puter.ai as {
    image?: { generate?: PuterImageGenerator }
    txt2img: (prompt: string | { prompt: string }) => Promise<{ src?: string } | string>
  }

  if (ai.image?.generate) {
    return ai.image.generate.bind(ai.image)
  }

  return (prompt) => ai.txt2img(prompt)
}

export async function generateImageWithPuter(prompt: string): Promise<PuterGeneratedImage> {
  if (typeof window === "undefined") {
    throw new Error("Puter image generation must run in the browser")
  }

  const trimmedPrompt = prompt.trim()
  if (!trimmedPrompt) {
    throw new Error("A prompt is required to generate an image")
  }

  const generate = await getPuterImageGenerator()
  const result = await generate({ prompt: trimmedPrompt })
  const localUrl = typeof result === "string"
    ? result
    : typeof result === "object" && result && "src" in result && typeof result.src === "string"
    ? result.src
    : ""

  if (!localUrl) {
    throw new Error("Puter returned an invalid image response")
  }

  const response = await fetch(localUrl)
  if (!response.ok) {
    throw new Error("Failed to read generated image data")
  }

  const blob = await response.blob()
  const mimeType = blob.type || "image/png"
  const base64Url = await imageToDataUrl(blob)

  return { localUrl, base64Url, mimeType }
}

export async function uploadGeneratedImage(params: {
  imageBase64Url: string
  mimeType?: string
  postId?: string
}) {
  const res = await fetch("/api/generate/image", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      image_base64: params.imageBase64Url,
      mime_type: params.mimeType,
      post_id: params.postId,
    }),
  })

  const data = await res.json()
  if (!res.ok) {
    throw new Error(data.error ?? "Image upload failed")
  }

  return data as { image_url: string }
}

export async function generateAndUploadPostImage(params: {
  prompt: string
  postId?: string
}) {
  const generated = await generateImageWithPuter(params.prompt)
  const uploaded = await uploadGeneratedImage({
    imageBase64Url: generated.base64Url,
    mimeType: generated.mimeType,
    postId: params.postId,
  })

  return {
    imageUrl: uploaded.image_url,
    localUrl: generated.localUrl,
    base64Url: generated.base64Url,
  }
}