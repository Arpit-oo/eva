"use client"

import { useState } from "react"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Loader2, Trash2, ImageIcon, Video, BookmarkPlus, ChevronDown, Play, Sparkles } from "lucide-react"
import type { PostRow, SocialPlatform } from "@/lib/types"

const PLATFORMS: SocialPlatform[] = ["linkedin", "twitter", "instagram", "facebook"]

interface Props {
  post: PostRow
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: (post: PostRow) => void
  onDeleted: (id: string) => void
}

export function PostEditorModal({ post, open, onOpenChange, onSaved, onDeleted }: Props) {
  const [caption, setCaption] = useState(post.caption)
  const [hashtagsStr, setHashtagsStr] = useState((post.hashtags ?? []).join(", "))
  const [platform, setPlatform] = useState<SocialPlatform>(post.platform)
  const [scheduledDate, setScheduledDate] = useState(post.scheduled_date ?? "")
  const [scheduledTime, setScheduledTime] = useState(post.scheduled_time ?? "")
  const [imagePrompt, setImagePrompt] = useState(post.image_prompt ?? "")
  const [imageUrl, setImageUrl] = useState(post.image_url ?? "")
  const [videoUrl, setVideoUrl] = useState(post.video_url ?? "")
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [generatingImage, setGeneratingImage] = useState(false)
  const [generatingVideo, setGeneratingVideo] = useState<false | "fal" | "veo2">(false)
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [evaluation, setEvaluation] = useState<{
    score: number
    strengths: string[]
    suggestions: string[]
    improved_caption: string
  } | null>(null)

  const handleOpenChange = (o: boolean) => {
    if (o) {
      setCaption(post.caption)
      setHashtagsStr((post.hashtags ?? []).join(", "))
      setPlatform(post.platform)
      setScheduledDate(post.scheduled_date ?? "")
      setScheduledTime(post.scheduled_time ?? "")
      setImagePrompt(post.image_prompt ?? "")
      setImageUrl(post.image_url ?? "")
      setVideoUrl(post.video_url ?? "")
      setEvaluation(null)
    }
    onOpenChange(o)
  }

  async function handleSave() {
    setSaving(true)
    try {
      const hashtags = hashtagsStr
        .split(",")
        .map((h) => h.trim().replace(/^#/, ""))
        .filter(Boolean)

      const res = await fetch(`/api/posts/${post.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caption,
          hashtags,
          platform,
          scheduled_date: scheduledDate || null,
          scheduled_time: scheduledTime || null,
          image_prompt: imagePrompt || null,
          image_url: imageUrl || null,
          video_url: videoUrl || null,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? "Save failed")
      }

      const data = await res.json()
      onSaved(data.post as PostRow)
      toast.success("Post saved")
      onOpenChange(false)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Save failed")
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!confirm("Delete this post? This cannot be undone.")) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/posts/${post.id}`, { method: "DELETE" })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? "Delete failed")
      }
      onDeleted(post.id)
      toast.success("Post deleted")
      onOpenChange(false)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Delete failed")
    } finally {
      setDeleting(false)
    }
  }

  async function handleGenerateImage() {
    if (!imagePrompt.trim()) {
      toast.error("Enter a visual prompt first")
      return
    }
    setGeneratingImage(true)
    try {
      const res = await fetch("/api/generate/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: imagePrompt, post_id: post.id }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? "Image generation failed")
      }
      const data = await res.json()
      setImageUrl(data.image_url)
      toast.success("Image generated!")
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Image generation failed")
    } finally {
      setGeneratingImage(false)
    }
  }

  async function handleGenerateVideo(provider: "fal" | "veo2") {
    const videoPrompt = imagePrompt.trim() || caption.slice(0, 500)
    if (!videoPrompt) {
      toast.error("Enter a visual prompt first")
      return
    }
    setGeneratingVideo(provider)
    try {
      const res = await fetch("/api/generate/video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: videoPrompt, post_id: post.id, provider }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? "Video generation failed")
      }
      const data = await res.json()
      setVideoUrl(data.video_url)
      toast.success(`Video generated via ${provider === "veo2" ? "Google Veo 2" : "fal.ai"}!`)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Video generation failed")
    } finally {
      setGeneratingVideo(false)
    }
  }

  async function handleAnalyze() {
    if (!caption.trim()) {
      toast.error("Caption is empty")
      return
    }
    setAnalyzing(true)
    setEvaluation(null)
    try {
      const hashtags = hashtagsStr
        .split(",")
        .map((h) => h.trim().replace(/^#/, ""))
        .filter(Boolean)
      const res = await fetch("/api/improve-post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caption, platform, hashtags }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? "Analysis failed")
      }
      const data = await res.json()
      setEvaluation(data.evaluation)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Analysis failed")
    } finally {
      setAnalyzing(false)
    }
  }

  async function handleSaveTemplate() {
    const name = window.prompt("Template name:")
    if (!name?.trim()) return
    setSavingTemplate(true)
    try {
      const res = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ post_id: post.id, template_name: name.trim() }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? "Save failed")
      }
      toast.success("Saved as template!")
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save template")
    } finally {
      setSavingTemplate(false)
    }
  }

  const charCount = caption.length
  const charLimit = platform === "twitter" ? 280 : platform === "linkedin" ? 3000 : 2200
  const overLimit = charCount > charLimit
  const anyGenerating = generatingImage || !!generatingVideo || analyzing

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="capitalize">Edit {platform} Post</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Platform */}
          <div className="space-y-1.5">
            <Label>Platform</Label>
            <Select value={platform} onValueChange={(v) => setPlatform(v as SocialPlatform)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PLATFORMS.map((p) => (
                  <SelectItem key={p} value={p} className="capitalize">
                    {p === "twitter" ? "Twitter / X" : p.charAt(0).toUpperCase() + p.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Caption */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>Caption</Label>
              <span className={`text-xs ${overLimit ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                {charCount} / {charLimit}
              </span>
            </div>
            <Textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              rows={7}
              className="resize-none font-mono text-sm"
              placeholder="Write your caption here..."
            />
          </div>

          {/* Analyze & Improve */}
          <div className="space-y-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleAnalyze}
              disabled={analyzing || saving || !caption.trim()}
              className="gap-1.5 w-full"
            >
              {analyzing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              {analyzing ? "Analyzing..." : "Analyze & Improve"}
            </Button>

            {evaluation && (
              <div className="rounded-lg border bg-muted/40 p-4 space-y-3 text-sm">
                {/* Score */}
                <div className="flex items-center gap-2">
                  <span className="font-medium">Content Score:</span>
                  <span
                    className={`font-bold px-2 py-0.5 rounded-full text-xs ${
                      evaluation.score >= 7
                        ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                        : evaluation.score >= 5
                        ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                        : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                    }`}
                  >
                    {evaluation.score}/10
                  </span>
                </div>

                {/* Strengths */}
                {evaluation.strengths.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-green-600 dark:text-green-400 uppercase tracking-wide">Strengths</p>
                    <ul className="space-y-0.5">
                      {evaluation.strengths.map((s, i) => (
                        <li key={i} className="text-xs text-muted-foreground flex gap-1.5">
                          <span className="text-green-500 shrink-0">✓</span>{s}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Suggestions */}
                {evaluation.suggestions.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wide">Suggestions</p>
                    <ul className="space-y-0.5">
                      {evaluation.suggestions.map((s, i) => (
                        <li key={i} className="text-xs text-muted-foreground flex gap-1.5">
                          <span className="text-amber-500 shrink-0">→</span>{s}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Improved Caption */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide">Improved Caption</p>
                  <p className="text-xs text-muted-foreground bg-background rounded-md p-2 border whitespace-pre-wrap">
                    {evaluation.improved_caption}
                  </p>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="w-full gap-1.5 text-xs h-7"
                    onClick={() => {
                      setCaption(evaluation.improved_caption)
                      setEvaluation(null)
                      toast.success("Caption updated!")
                    }}
                  >
                    <Sparkles className="h-3 w-3" />
                    Use Improved Caption
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Hashtags */}
          <div className="space-y-1.5">
            <Label>Hashtags</Label>
            <Input
              value={hashtagsStr}
              onChange={(e) => setHashtagsStr(e.target.value)}
              placeholder="marketing, contentcreation, brandstrategy"
            />
            <p className="text-xs text-muted-foreground">Comma-separated, # is optional</p>
          </div>

          {/* Schedule */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Scheduled Date</Label>
              <Input type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Scheduled Time</Label>
              <Input type="time" value={scheduledTime} onChange={(e) => setScheduledTime(e.target.value)} />
            </div>
          </div>

          {/* Visual Prompt + Media Generation */}
          <div className="space-y-2">
            <Label>Visual Prompt</Label>
            <Textarea
              value={imagePrompt}
              onChange={(e) => setImagePrompt(e.target.value)}
              rows={3}
              className="resize-none text-sm"
              placeholder="Describe the visual for this post — used for both image and video generation..."
            />
            <div className="flex flex-wrap gap-2">
              {/* Generate Image */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleGenerateImage}
                disabled={anyGenerating || !imagePrompt.trim()}
                className="gap-1.5"
              >
                {generatingImage ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <ImageIcon className="h-3.5 w-3.5" />
                )}
                {generatingImage ? "Generating..." : "Generate Image (Imagen 3)"}
              </Button>

              {/* Generate Video dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" disabled={anyGenerating} className="gap-1.5">
                    {generatingVideo ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Video className="h-3.5 w-3.5" />
                    )}
                    {generatingVideo
                      ? `Generating via ${generatingVideo === "veo2" ? "Veo 2" : "fal.ai"}...`
                      : "Generate Video"}
                    {!generatingVideo && <ChevronDown className="h-3 w-3" />}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem onClick={() => handleGenerateVideo("fal")}>
                    <Video className="h-3.5 w-3.5 mr-2" />
                    fal.ai — WanVideo 2.1 (fast, ~30s)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleGenerateVideo("veo2")}>
                    <Play className="h-3.5 w-3.5 mr-2" />
                    Google Veo 2 (cinematic, ~2-3 min)
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Generated Image Preview */}
          {imageUrl && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>Generated Image</Label>
                <button
                  onClick={() => setImageUrl("")}
                  className="text-xs text-muted-foreground hover:text-destructive transition-colors"
                >
                  Remove
                </button>
              </div>
              <div className="relative w-full aspect-square max-w-xs rounded-lg overflow-hidden border bg-muted">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageUrl}
                  alt="Generated"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          )}

          {/* Generated Video Preview */}
          {videoUrl && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>Generated Video</Label>
                <button
                  onClick={() => setVideoUrl("")}
                  className="text-xs text-muted-foreground hover:text-destructive transition-colors"
                >
                  Remove
                </button>
              </div>
              <video
                src={videoUrl}
                controls
                loop
                playsInline
                className="w-full max-w-xs rounded-lg border bg-muted"
              />
            </div>
          )}
        </div>

        <DialogFooter className="flex-row items-center justify-between gap-2 pt-2">
          <div className="flex gap-2">
            <Button variant="destructive" size="sm" onClick={handleDelete} disabled={deleting || saving}>
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Delete
            </Button>
            <Button variant="ghost" size="sm" onClick={handleSaveTemplate} disabled={savingTemplate || saving} className="gap-1.5">
              {savingTemplate ? <Loader2 className="h-4 w-4 animate-spin" /> : <BookmarkPlus className="h-4 w-4" />}
              Save as Template
            </Button>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving || overLimit}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Save Post
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
