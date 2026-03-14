"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { generateAndUploadPostImage } from "@/lib/puter-image"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sparkles,
  Loader2,
  RefreshCw,
  Calendar,
  ChevronRight,
  Pencil,
  FileText,
  Clock,
  Plus,
  Linkedin,
  Twitter,
  Instagram,
  Facebook,
} from "lucide-react"
import { PostEditorModal } from "@/components/post-editor-modal"
import { cn } from "@/lib/utils"
import type { BrandProfileRow, StrategyRow, PostRow } from "@/lib/types"
import { CatLoader } from "@/components/ui/cat-loader"

const DAY_META: Record<string, { border: string; initial: string }> = {
  Monday: { border: "#3b82f6", initial: "M" },
  Tuesday: { border: "#8b5cf6", initial: "T" },
  Wednesday: { border: "#ec4899", initial: "W" },
  Thursday: { border: "#f97316", initial: "T" },
  Friday: { border: "#10b981", initial: "F" },
  Saturday: { border: "#06b6d4", initial: "S" },
  Sunday: { border: "#f59e0b", initial: "S" },
}

const CONTENT_TYPE_STYLES: Record<string, { background: string; color: string }> = {
  Educational: { background: "var(--gen-type-educational-bg)", color: "var(--gen-type-educational-text)" },
  Engagement: { background: "var(--gen-type-engagement-bg)", color: "var(--gen-type-engagement-text)" },
  Promotional: { background: "var(--gen-type-promotional-bg)", color: "var(--gen-type-promotional-text)" },
  Motivational: { background: "var(--gen-type-motivational-bg)", color: "var(--gen-type-motivational-text)" },
  "Behind-the-Scenes": { background: "var(--gen-type-bts-bg)", color: "var(--gen-type-bts-text)" },
  Story: { background: "var(--gen-type-story-bg)", color: "var(--gen-type-story-text)" },
  "Case Study": { background: "var(--gen-type-case-study-bg)", color: "var(--gen-type-case-study-text)" },
}

const PLATFORM_ICONS: Record<string, string> = {
  linkedin: "in",
  twitter: "X",
  instagram: "ig",
  facebook: "fb",
}

const PLATFORM_COLORS: Record<string, { background: string; color: string }> = {
  linkedin: { background: "#0a66c2", color: "#ffffff" },
  twitter: { background: "#1da1f2", color: "#ffffff" },
  instagram: { background: "#e1306c", color: "#ffffff" },
  facebook: { background: "#1877f2", color: "#ffffff" },
}

const PLATFORM_BORDER_COLORS: Record<string, string> = {
  linkedin: "#0a66c2",
  twitter: "#1da1f2",
  instagram: "#e1306c",
  facebook: "#1877f2",
}

const PLATFORM_WATERMARK_ICONS = {
  linkedin: Linkedin,
  twitter: Twitter,
  instagram: Instagram,
  facebook: Facebook,
} as const

function formatDate(weekStart: string) {
  const d = new Date(weekStart + "T00:00:00")
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00")
  d.setDate(d.getDate() + days)
  return d.toISOString().split("T")[0]
}

const DAY_OFFSET: Record<string, number> = {
  Monday: 0,
  Tuesday: 1,
  Wednesday: 2,
  Thursday: 3,
  Friday: 4,
  Saturday: 5,
  Sunday: 6,
}

function getStrategyMaxDayOffset(strategy: StrategyRow): number {
  const days = strategy.strategy_json.days ?? []
  if (!days.length) return 0
  return Math.max(...days.map((day) => DAY_OFFSET[day.day_of_week] ?? 0))
}

type AiCheckResult = {
  authenticity_score: number
  verdict: "likely_human" | "mixed" | "likely_ai"
  rationale: string
  suggestions: string[]
}

export default function GeneratePage() {
  const supabase = createClient()
  const router = useRouter()

  const [profiles, setProfiles] = useState<BrandProfileRow[]>([])
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null)
  const [strategies, setStrategies] = useState<StrategyRow[]>([])
  const [selectedStrategy, setSelectedStrategy] = useState<StrategyRow | null>(null)
  const [generating, setGenerating] = useState(false)
  const [loadingInit, setLoadingInit] = useState(true)

  // Phase 4
  const [posts, setPosts] = useState<PostRow[]>([])
  const [generatingPosts, setGeneratingPosts] = useState(false)
  const [imageProgress, setImageProgress] = useState<{ completed: number; total: number } | null>(null)
  const [editingPost, setEditingPost] = useState<PostRow | null>(null)
  const [loadingPosts, setLoadingPosts] = useState(false)
  const [checkingPostId, setCheckingPostId] = useState<string | null>(null)
  const [aiChecks, setAiChecks] = useState<Record<string, AiCheckResult>>({})

  useEffect(() => {
    loadInit()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadInit() {
    setLoadingInit(true)
    const [profilesRes, userRes] = await Promise.all([
      fetch("/api/brand-profiles"),
      supabase.from("Users").select("active_brand_profile_id").single(),
    ])

    let activeId: string | null = null
    if (!userRes.error && userRes.data) {
      activeId = userRes.data.active_brand_profile_id
      setActiveProfileId(activeId)
    }
    if (profilesRes.ok) {
      const data = await profilesRes.json()
      setProfiles(data.profiles ?? [])
    }

    if (activeId) {
      await loadStrategies(activeId)
    }
    setLoadingInit(false)
  }

  async function loadStrategies(profileId: string) {
    const res = await fetch(`/api/strategies?brand_profile_id=${profileId}&limit=10`)
    if (res.ok) {
      const data = await res.json()
      const list: StrategyRow[] = data.strategies ?? []
      setStrategies(list)
      const first = list[0] ?? null
      setSelectedStrategy(first)
      if (first) await loadPosts(first)
    }
  }

  async function loadPosts(strategy: StrategyRow) {
    setLoadingPosts(true)
    try {
      const weekEnd = addDays(strategy.week_start, getStrategyMaxDayOffset(strategy))
      const res = await fetch(`/api/posts?start_date=${strategy.week_start}&end_date=${weekEnd}`)
      if (res.ok) {
        const data = await res.json()
        setPosts(data.posts ?? [])
      }
    } finally {
      setLoadingPosts(false)
    }
  }

  async function handleProfileChange(id: string) {
    if (id === "__create_brand__") {
      router.push("/settings#profile")
      return
    }
    setActiveProfileId(id)
    setStrategies([])
    setSelectedStrategy(null)
    setPosts([])
    await supabase
      .from("Users")
      .update({ active_brand_profile_id: id })
      .eq("id", (await supabase.auth.getUser()).data.user!.id)
    await loadStrategies(id)
  }

  async function handleGenerate() {
    if (!activeProfileId) {
      toast.error("Select a brand profile first")
      return
    }
    setGenerating(true)
    setPosts([])
    try {
      if (strategies.length > 0) {
        toast("Regenerating strategy...", {
          description: "EVA is building a fresh content plan.",
        })
      }
      const res = await fetch("/api/generate/strategy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brand_profile_id: activeProfileId }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? "Generation failed")
      }
      const data = await res.json()
      const newStrategy = data.strategy as StrategyRow
      setStrategies((prev) => [newStrategy, ...prev])
      setSelectedStrategy(newStrategy)
      setAiChecks({})
      toast.success("Strategy generated!")
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Generation failed")
    } finally {
      setGenerating(false)
    }
  }

  async function handleGeneratePosts() {
    if (!selectedStrategy) return
    setGeneratingPosts(true)
    setImageProgress(null)
    setAiChecks({})
    try {
      const res = await fetch("/api/generate/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ strategy_id: selectedStrategy.id }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? "Post generation failed")
      }
      const data = await res.json()
      const generatedPosts = (data.posts ?? []) as PostRow[]
      setPosts(generatedPosts)

      const candidates = generatedPosts.filter(
        (post) => (post.image_prompt?.trim() || post.caption.trim()) && !post.image_url
      )

      if (candidates.length === 0) {
        toast("Posts regenerated!", {
          description: "Your 7 posts are ready to review.",
          action: {
            label: "View Posts",
            onClick: () => {
              const cards = document.querySelector(".generate-post-card")
              if (cards) cards.scrollIntoView({ behavior: "smooth", block: "start" })
            },
          },
        })
        return
      }

      setImageProgress({ completed: 0, total: candidates.length })

      let imageFailures = 0

      for (let index = 0; index < candidates.length; index += 1) {
        const post = candidates[index]
        const prompt = post.image_prompt?.trim() || post.caption.trim()

        try {
          const result = await generateAndUploadPostImage({
            prompt,
            postId: post.id,
          })

          setPosts((currentPosts) =>
            currentPosts.map((currentPost) =>
              currentPost.id === post.id
                ? { ...currentPost, image_url: result.imageUrl }
                : currentPost
            )
          )
        } catch (error) {
          imageFailures += 1
          console.error(`Image generation failed for post ${post.id}:`, error)
        } finally {
          setImageProgress({ completed: index + 1, total: candidates.length })
        }
      }

      if (imageFailures > 0) {
        toast.warning(`${imageFailures} visuals could not be attached, but your posts are ready.`)
      }

      toast("Posts regenerated!", {
        description: "Your 7 posts are ready to review.",
        action: {
          label: "View Posts",
          onClick: () => {
            const cards = document.querySelector(".generate-post-card")
            if (cards) cards.scrollIntoView({ behavior: "smooth", block: "start" })
          },
        },
      })
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Post generation failed")
    } finally {
      setImageProgress(null)
      setGeneratingPosts(false)
    }
  }

  async function handleAiCheck(post: PostRow) {
    setCheckingPostId(post.id)
    try {
      const res = await fetch("/api/generate/ai-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ post_id: post.id }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? "AI check failed")
      }

      const result = (await res.json()) as AiCheckResult
      setAiChecks((prev) => ({ ...prev, [post.id]: result }))
      toast("AI Check complete", {
        description: "Quality score ready. Check your post card.",
      })
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "AI check failed")
    } finally {
      setCheckingPostId(null)
    }
  }

  const activeProfile = profiles.find((p) => p.id === activeProfileId)

  if (loadingInit) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (profiles.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Generate</h1>
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
            <Sparkles className="h-10 w-10 opacity-40" />
            <p className="text-sm">You need a brand profile before generating content.</p>
            <Button variant="outline" size="sm" onClick={() => (window.location.href = "/settings")}>
              Create Brand Profile
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6 generate-page">
      {/* Header */}
      <div className="generate-header-card flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between px-5 py-4">
        <div>
          <h1 className="text-2xl font-semibold generate-header-title">Generate</h1>
          <p className="text-muted-foreground text-sm generate-header-subtitle">AI-powered weekly content strategy</p>
        </div>
        <div className="flex items-center gap-3">
          {profiles.length >= 1 && (
            <Select value={activeProfileId ?? ""} onValueChange={handleProfileChange}>
              <SelectTrigger className="w-44 generate-brand-select">
                <SelectValue placeholder="Select profile" />
              </SelectTrigger>
              <SelectContent className="generate-brand-menu">
                {profiles.map((p) => (
                  <SelectItem key={p.id} value={p.id} className="generate-brand-item">
                    {p.brand_name}
                  </SelectItem>
                ))}
                <SelectSeparator />
                <SelectItem value="__create_brand__" className="generate-brand-item generate-create-brand-item">
                  <span className="flex items-center gap-1.5">
                    <Plus className="h-3.5 w-3.5" />
                    Create Brand Identity
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          )}
          <Button
            variant="outline"
            onClick={handleGenerate}
            disabled={generating}
            className="calendar-refresh-btn"
          >
            {generating ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : strategies.length > 0 ? (
              <RefreshCw className="h-[15px] w-[15px] mr-2" />
            ) : (
              <Sparkles className="h-4 w-4 mr-2" />
            )}
            {generating ? "Generating..." : strategies.length > 0 ? "Regenerate" : "Generate Strategy"}
          </Button>
        </div>
      </div>

      {/* No strategy yet */}
      {!selectedStrategy && !generating && (
        <Card className="eva-surface border-dashed border-white/20">
          <CardContent className="flex flex-col items-center justify-center py-16 gap-4 text-muted-foreground">
            <Sparkles className="h-10 w-10 opacity-40" />
            <div className="text-center">
              <p className="text-sm font-medium text-foreground">No strategy yet</p>
              <p className="text-sm mt-1">
                Click &quot;Generate Strategy&quot; to create a content plan for{" "}
                <span className="font-medium">{activeProfile?.brand_name}</span>
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Generating skeleton */}
      {generating && (
        <CatLoader overlay />
      )}

      {/* Strategy display */}
      {selectedStrategy && !generating && (
        <>
          {/* Strategy selector */}
          {strategies.length > 1 && (
            <div className="eva-surface flex items-center gap-2 text-sm px-4 py-2">
              <span className="text-muted-foreground">Viewing strategy from:</span>
              <Select
                value={selectedStrategy.id}
                onValueChange={(id) => {
                  const s = strategies.find((s) => s.id === id)
                  if (s) {
                    setSelectedStrategy(s)
                    setPosts([])
                    loadPosts(s)
                  }
                }}
              >
                <SelectTrigger className="h-8 w-52">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="generate-brand-menu">
                  {strategies.map((s) => (
                    <SelectItem key={s.id} value={s.id} className="generate-brand-item">
                      Week of {formatDate(s.week_start)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Week theme banner */}
          <Card className="generate-week-banner">
            <CardContent className="flex items-center gap-3 py-4">
              <Calendar className="h-5 w-5 shrink-0 opacity-80" />
              <div>
                <p className="text-xs opacity-70 uppercase tracking-wide font-medium generate-week-label">
                  Week Theme &middot; {formatDate(selectedStrategy.week_start)}
                </p>
                <p className="font-semibold text-lg leading-snug generate-week-title">
                  {selectedStrategy.strategy_json.week_theme}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Strategy grid */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {selectedStrategy.strategy_json.days.map((day) => (
              <Card
                key={day.day_of_week}
                className="eva-elevated relative overflow-hidden"
                style={{ borderTop: `3px solid ${DAY_META[day.day_of_week]?.border ?? "#3b82f6"}` }}
              >
                <CardHeader className="pb-2 pt-4 relative z-[1]">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold generate-day-name">{day.day_of_week}</CardTitle>
                    <Badge
                      variant="outline"
                      className="text-xs shrink-0 border-0 rounded-[20px] px-[10px] py-[3px]"
                      style={{
                        background: CONTENT_TYPE_STYLES[day.content_type]?.background,
                        color: CONTENT_TYPE_STYLES[day.content_type]?.color,
                        fontSize: "12px",
                      }}
                    >
                      {day.content_type}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 pb-4 relative z-[1]">
                  <p className="text-sm leading-snug generate-day-topic">{day.theme}</p>
                  <span
                    className="inline-block rounded-[20px] px-[10px] py-[3px] font-medium"
                    style={{
                      background: "var(--gen-tone-chip-bg)",
                      color: "var(--gen-tone-chip-text)",
                      fontSize: "11px",
                    }}
                  >
                    {day.target_emotion}
                  </span>
                </CardContent>
                <span
                  className="pointer-events-none absolute bottom-[10px] right-[14px] z-0 select-none text-[64px] font-bold leading-none generate-day-watermark"
                  style={{ opacity: "var(--gen-day-watermark-opacity)" }}
                >
                  {DAY_META[day.day_of_week]?.initial ?? day.day_of_week.charAt(0)}
                </span>
              </Card>
            ))}
          </div>

          {/* Generate Posts CTA */}
          <div className="flex justify-end pt-2">
            <Button
              variant="outline"
              onClick={handleGeneratePosts}
              disabled={generatingPosts}
              className="gap-2 calendar-refresh-btn"
            >
              {generatingPosts ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileText className="h-4 w-4" />
              )}
              {generatingPosts
                ? imageProgress
                  ? "Generating images..."
                  : "Generating posts..."
                : posts.length > 0
                ? "Regenerate Posts"
                : "Generate Posts from Strategy"}
              {!generatingPosts && <ChevronRight className="h-4 w-4" />}
            </Button>
          </div>

          {/* Generating posts loading */}
          {generatingPosts && (
            <CatLoader overlay />
          )}

          {/* Posts Grid */}
          {posts.length > 0 && !generatingPosts && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Generated Posts</h2>
                <span className="text-sm text-muted-foreground">
                  {posts.length} post{posts.length !== 1 ? "s" : ""}
                </span>
              </div>

              {loadingPosts ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {posts.map((post) => (
                    <Card
                      key={post.id}
                      className="eva-elevated relative group generate-post-card"
                      style={{ borderLeft: `3px solid ${PLATFORM_BORDER_COLORS[post.platform] ?? "#6b7280"}` }}
                    >
                      <CardHeader className="pb-2 pt-4 relative z-[1]">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span
                              className="text-xs font-bold px-2 py-0.5 rounded uppercase tracking-wide"
                              style={PLATFORM_COLORS[post.platform] ?? { background: "hsl(var(--muted))", color: "hsl(var(--foreground))" }}
                            >
                              {PLATFORM_ICONS[post.platform] ?? post.platform}
                            </span>
                            <span className="text-xs text-muted-foreground capitalize">
                              {post.platform}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            {post.scheduled_date && (
                              <span className="text-xs text-muted-foreground flex items-center gap-1 generate-post-time">
                                <Clock className="h-3 w-3" />
                                {new Date(
                                  post.scheduled_date + "T00:00:00"
                                ).toLocaleDateString("en-US", {
                                  weekday: "short",
                                  month: "short",
                                  day: "numeric",
                                })}
                                {post.scheduled_time && ` · ${post.scheduled_time.slice(0, 5)}`}
                              </span>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3 pb-4 relative z-[1]">
                        <p className="text-sm leading-relaxed line-clamp-4 generate-post-caption">{post.caption}</p>
                        {post.hashtags && post.hashtags.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {post.hashtags.slice(0, 5).map((tag) => (
                              <span key={tag} style={{ color: "var(--gen-hashtag-color)", fontSize: "13px" }}>
                                #{String(tag).replace(/^#+/, "")}
                              </span>
                            ))}
                            {post.hashtags.length > 5 && (
                              <span className="text-xs text-muted-foreground">
                                +{post.hashtags.length - 5} more
                              </span>
                            )}
                          </div>
                        )}
                        <div className="grid grid-cols-2 gap-2 pt-1">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-9"
                            onClick={() => handleAiCheck(post)}
                            disabled={checkingPostId === post.id}
                          >
                            {checkingPostId === post.id ? (
                              <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : (
                              <Sparkles className="h-4 w-4 mr-2" />
                            )}
                            AI Checker
                          </Button>
                          <Button
                            variant="default"
                            size="sm"
                            className="h-9 generate-edit-btn"
                            onClick={() => setEditingPost(post)}
                          >
                            <Pencil className="h-[15px] w-[15px] mr-2 text-white" />
                            Edit Post
                          </Button>
                        </div>
                        {aiChecks[post.id] && (
                          <div className="rounded-md border px-3 py-2 text-xs space-y-1 bg-background/70">
                            <p className="font-medium">
                              AI Checker: {aiChecks[post.id].authenticity_score}/100 ({aiChecks[post.id].verdict.replace("_", " ")})
                            </p>
                            <p className="text-muted-foreground">{aiChecks[post.id].rationale}</p>
                            {aiChecks[post.id].suggestions.length > 0 && (
                              <p className="text-muted-foreground">
                                Try: {aiChecks[post.id].suggestions.join(" • ")}
                              </p>
                            )}
                          </div>
                        )}
                        <Badge
                          variant="outline"
                          className="text-xs capitalize"
                          style={
                            post.status === "draft"
                              ? {
                                  background: "var(--gen-draft-bg)",
                                  color: "var(--gen-draft-text)",
                                  border: "1px solid var(--gen-draft-border)",
                                  borderRadius: "6px",
                                  padding: "3px 10px",
                                  fontSize: "12px",
                                }
                              : undefined
                          }
                        >
                          {post.status}
                        </Badge>
                      </CardContent>
                      {(() => {
                        const PlatformWatermarkIcon =
                          PLATFORM_WATERMARK_ICONS[post.platform as keyof typeof PLATFORM_WATERMARK_ICONS] ?? FileText
                        return (
                          <PlatformWatermarkIcon
                            className={cn(
                              "pointer-events-none absolute bottom-3 right-3 h-12 w-12 z-0 platform-watermark",
                              post.platform === "linkedin" && "platform-watermark-linkedin",
                              post.platform === "twitter" && "platform-watermark-twitter",
                              post.platform === "instagram" && "platform-watermark-instagram",
                              post.platform === "facebook" && "platform-watermark-facebook"
                            )}
                          />
                        )
                      })()}
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Post Editor Modal */}
      {editingPost && (
        <PostEditorModal
          post={editingPost}
          open={!!editingPost}
          onOpenChange={(o) => {
            if (!o) setEditingPost(null)
          }}
          onSaved={(updated) => {
            setPosts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
            setEditingPost(null)
          }}
          onDeleted={(id) => {
            setPosts((prev) => prev.filter((p) => p.id !== id))
            setEditingPost(null)
          }}
        />
      )}
    </div>
  )
}
