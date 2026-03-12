"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
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
} from "lucide-react"
import { PostEditorModal } from "@/components/post-editor-modal"
import type { BrandProfileRow, StrategyRow, PostRow } from "@/lib/types"

const EMOTION_COLORS: Record<string, string> = {
  Inspired: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
  Curious: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  Trusting: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  Excited: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
  Amused: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
  Motivated: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  Empowered: "bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300",
}

const TYPE_COLORS: Record<string, string> = {
  Educational: "default",
  Motivational: "default",
  "Behind-the-Scenes": "secondary",
  "Case Study": "secondary",
  Promotional: "destructive",
  Engagement: "outline",
  Story: "outline",
}

const PLATFORM_ICONS: Record<string, string> = {
  linkedin: "in",
  twitter: "X",
  instagram: "ig",
  facebook: "fb",
}

const PLATFORM_COLORS: Record<string, string> = {
  linkedin: "bg-blue-600 text-white",
  twitter: "bg-black text-white",
  instagram: "bg-pink-500 text-white",
  facebook: "bg-blue-500 text-white",
}

function emotionClass(emotion: string) {
  return (
    EMOTION_COLORS[emotion] ??
    "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300"
  )
}

function formatDate(weekStart: string) {
  const d = new Date(weekStart + "T00:00:00")
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00")
  d.setDate(d.getDate() + days)
  return d.toISOString().split("T")[0]
}

export default function GeneratePage() {
  const supabase = createClient()

  const [profiles, setProfiles] = useState<BrandProfileRow[]>([])
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null)
  const [strategies, setStrategies] = useState<StrategyRow[]>([])
  const [selectedStrategy, setSelectedStrategy] = useState<StrategyRow | null>(null)
  const [generating, setGenerating] = useState(false)
  const [loadingInit, setLoadingInit] = useState(true)

  // Phase 4
  const [posts, setPosts] = useState<PostRow[]>([])
  const [generatingPosts, setGeneratingPosts] = useState(false)
  const [editingPost, setEditingPost] = useState<PostRow | null>(null)
  const [loadingPosts, setLoadingPosts] = useState(false)

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
      const weekEnd = addDays(strategy.week_start, 6)
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
      setPosts(data.posts ?? [])
      toast.success(`${(data.posts as PostRow[]).length} posts generated!`)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Post generation failed")
    } finally {
      setGeneratingPosts(false)
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Generate</h1>
          <p className="text-muted-foreground text-sm">AI-powered weekly content strategy</p>
        </div>
        <div className="flex items-center gap-3">
          {profiles.length > 1 && (
            <Select value={activeProfileId ?? ""} onValueChange={handleProfileChange}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Select profile" />
              </SelectTrigger>
              <SelectContent>
                {profiles.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.brand_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button onClick={handleGenerate} disabled={generating}>
            {generating ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : strategies.length > 0 ? (
              <RefreshCw className="h-4 w-4 mr-2" />
            ) : (
              <Sparkles className="h-4 w-4 mr-2" />
            )}
            {generating ? "Generating..." : strategies.length > 0 ? "Regenerate" : "Generate Strategy"}
          </Button>
        </div>
      </div>

      {/* No strategy yet */}
      {!selectedStrategy && !generating && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 gap-4 text-muted-foreground">
            <Sparkles className="h-10 w-10 opacity-40" />
            <div className="text-center">
              <p className="text-sm font-medium text-foreground">No strategy yet</p>
              <p className="text-sm mt-1">
                Click &quot;Generate Strategy&quot; to create a 7-day content plan for{" "}
                <span className="font-medium">{activeProfile?.brand_name}</span>
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Generating skeleton */}
      {generating && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <div className="text-center">
              <p className="font-medium">Crafting your strategy...</p>
              <p className="text-sm text-muted-foreground mt-1">GPT-4o-mini is analysing your brand profile</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Strategy display */}
      {selectedStrategy && !generating && (
        <>
          {/* Strategy selector */}
          {strategies.length > 1 && (
            <div className="flex items-center gap-2 text-sm">
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
                <SelectContent>
                  {strategies.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      Week of {formatDate(s.week_start)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Week theme banner */}
          <Card className="bg-primary text-primary-foreground border-0">
            <CardContent className="flex items-center gap-3 py-4">
              <Calendar className="h-5 w-5 shrink-0 opacity-80" />
              <div>
                <p className="text-xs opacity-70 uppercase tracking-wide font-medium">
                  Week Theme &middot; {formatDate(selectedStrategy.week_start)}
                </p>
                <p className="font-semibold text-lg leading-snug">
                  {selectedStrategy.strategy_json.week_theme}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* 7-day strategy grid */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {selectedStrategy.strategy_json.days.map((day) => (
              <Card key={day.day_of_week} className="relative overflow-hidden">
                <CardHeader className="pb-2 pt-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold">{day.day_of_week}</CardTitle>
                    <Badge
                      variant={
                        (TYPE_COLORS[day.content_type] as
                          | "default"
                          | "secondary"
                          | "outline"
                          | "destructive") ?? "secondary"
                      }
                      className="text-xs shrink-0"
                    >
                      {day.content_type}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 pb-4">
                  <p className="text-sm leading-snug">{day.theme}</p>
                  <span
                    className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${emotionClass(
                      day.target_emotion
                    )}`}
                  >
                    {day.target_emotion}
                  </span>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Generate Posts CTA */}
          <div className="flex justify-end pt-2">
            <Button onClick={handleGeneratePosts} disabled={generatingPosts} className="gap-2">
              {generatingPosts ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileText className="h-4 w-4" />
              )}
              {generatingPosts
                ? "Generating posts..."
                : posts.length > 0
                ? "Regenerate Posts"
                : "Generate Posts from Strategy"}
              {!generatingPosts && <ChevronRight className="h-4 w-4" />}
            </Button>
          </div>

          {/* Generating posts loading */}
          {generatingPosts && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 gap-4">
                <Loader2 className="h-7 w-7 animate-spin text-primary" />
                <div className="text-center">
                  <p className="font-medium">Writing your posts...</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Generating platform-specific content for all 7 days
                  </p>
                </div>
              </CardContent>
            </Card>
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
                    <Card key={post.id} className="relative group">
                      <CardHeader className="pb-2 pt-4">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-xs font-bold px-2 py-0.5 rounded uppercase tracking-wide ${
                                PLATFORM_COLORS[post.platform] ?? "bg-muted text-foreground"
                              }`}
                            >
                              {PLATFORM_ICONS[post.platform] ?? post.platform}
                            </span>
                            <span className="text-xs text-muted-foreground capitalize">
                              {post.platform}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            {post.scheduled_date && (
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
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
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => setEditingPost(post)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              <span className="sr-only">Edit post</span>
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3 pb-4">
                        <p className="text-sm leading-relaxed line-clamp-4">{post.caption}</p>
                        {post.hashtags && post.hashtags.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {post.hashtags.slice(0, 5).map((tag) => (
                              <span key={tag} className="text-xs text-primary">
                                #{tag}
                              </span>
                            ))}
                            {post.hashtags.length > 5 && (
                              <span className="text-xs text-muted-foreground">
                                +{post.hashtags.length - 5} more
                              </span>
                            )}
                          </div>
                        )}
                        <Badge variant="outline" className="text-xs capitalize">
                          {post.status}
                        </Badge>
                      </CardContent>
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
