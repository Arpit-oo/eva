"use client"

import { useEffect, useState, useCallback } from "react"
import { toast } from "sonner"
import {
  Loader2,
  Library,
  RefreshCw,
  Search,
  Filter,
  ImageIcon,
  Video,
  SlidersHorizontal,
  ShieldCheck,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { PostEditorModal } from "@/components/post-editor-modal"
import type { PostRow } from "@/lib/types"

const PLATFORM_COLORS: Record<string, string> = {
  linkedin: "#0077B5",
  instagram: "#E1306C",
  twitter: "#1DA1F2",
  facebook: "#1877F2",
  tiktok: "#69C9D0",
}

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  draft: "outline",
  scheduled: "secondary",
  published: "default",
}

export default function LibraryPage() {
  const [posts, setPosts] = useState<PostRow[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPost, setSelectedPost] = useState<PostRow | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [filterPlatform, setFilterPlatform] = useState("all")
  const [filterStatus, setFilterStatus] = useState("all")
  const [aiScores, setAiScores] = useState<Record<string, number>>({})
  const [checkingPostIds, setCheckingPostIds] = useState<Record<string, boolean>>({})
  const [checkingAll, setCheckingAll] = useState(false)

  const fetchPosts = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/posts")
      if (!res.ok) throw new Error("Failed to load posts")
      const data = await res.json()
      setPosts(data.posts ?? [])
      setAiScores({})
      setCheckingPostIds({})
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load posts")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPosts()
  }, [fetchPosts])

  const handlePostSaved = useCallback((updated: PostRow) => {
    setPosts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
  }, [])

  const handlePostDeleted = useCallback((id: string) => {
    setPosts((prev) => prev.filter((p) => p.id !== id))
  }, [])

  const runAiCheckForPost = useCallback(async (post: PostRow) => {
    setCheckingPostIds((prev) => ({ ...prev, [post.id]: true }))
    try {
      const res = await fetch("/api/improve-post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caption: post.caption,
          platform: post.platform,
          hashtags: post.hashtags,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? "AI check failed")
      }

      const data = await res.json()
      const rawScore = Number(data?.evaluation?.score ?? 0)
      const normalized = Math.max(1, Math.min(10, Number.isFinite(rawScore) ? rawScore : 0))
      const percent = normalized * 10
      setAiScores((prev) => ({ ...prev, [post.id]: percent }))
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "AI check failed")
    } finally {
      setCheckingPostIds((prev) => ({ ...prev, [post.id]: false }))
    }
  }, [])

  const filtered = posts.filter((p) => {
    if (filterPlatform !== "all" && p.platform !== filterPlatform) return false
    if (filterStatus !== "all" && p.status !== filterStatus) return false
    if (search.trim()) {
      const q = search.toLowerCase()
      if (
        !p.caption?.toLowerCase().includes(q) &&
        !p.hashtags?.some((h) => h.toLowerCase().includes(q))
      )
        return false
    }
    return true
  })

  const runAiCheckForAll = useCallback(async () => {
    if (filtered.length === 0) return
    setCheckingAll(true)
    try {
      for (const post of filtered) {
        // eslint-disable-next-line no-await-in-loop
        await runAiCheckForPost(post)
      }
      toast.success("AI checker complete")
    } finally {
      setCheckingAll(false)
    }
  }, [filtered, runAiCheckForPost])

  const platforms = Array.from(new Set(posts.map((p) => p.platform)))

  return (
    <div className="flex flex-col gap-6 p-6 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Library className="h-6 w-6 text-primary" />
            Post Library
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            All your generated and saved posts in one place.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchPosts} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search captions, hashtags..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
          <Select value={filterPlatform} onValueChange={setFilterPlatform}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Platform" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Platforms</SelectItem>
              {platforms.map((p) => (
                <SelectItem key={p} value={p} className="capitalize">
                  {p === "twitter" ? "Twitter/X" : p.charAt(0).toUpperCase() + p.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="scheduled">Scheduled</SelectItem>
              <SelectItem value="published">Published</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <span className="text-xs text-muted-foreground ml-auto">
          {filtered.length} post{filtered.length !== 1 ? "s" : ""}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={runAiCheckForAll}
          disabled={checkingAll || filtered.length === 0}
          className="gap-1.5"
        >
          {checkingAll ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
          {checkingAll ? "Checking..." : "Run AI Checker"}
        </Button>
      </div>

      {/* Posts grid */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
          <Filter className="h-10 w-10 opacity-30" />
          <p className="text-sm">
            {posts.length === 0 ? "No posts yet. Generate some posts to get started." : "No posts match your filters."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((post) => (
            <div
              key={post.id}
              className="bg-card border rounded-xl overflow-hidden flex flex-col group hover:border-primary/60 transition-colors cursor-pointer"
              role="button"
              tabIndex={0}
              onClick={() => {
                setSelectedPost(post)
                setModalOpen(true)
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault()
                  setSelectedPost(post)
                  setModalOpen(true)
                }
              }}
            >
              {/* Image thumbnail */}
              {post.image_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={post.image_url}
                  alt=""
                  className="w-full aspect-video object-cover"
                />
              )}

              <div className="p-4 flex flex-col gap-2 flex-1">
                {/* Platform + status */}
                <div className="flex items-center gap-2">
                  <Badge
                    variant="secondary"
                    className="capitalize text-xs"
                    style={{
                      backgroundColor: (PLATFORM_COLORS[post.platform] ?? "#6366f1") + "20",
                      color: PLATFORM_COLORS[post.platform] ?? "#6366f1",
                    }}
                  >
                    {post.platform === "twitter" ? "Twitter/X" : post.platform}
                  </Badge>
                  <Badge variant={STATUS_VARIANTS[post.status] ?? "outline"} className="capitalize text-xs">
                    {post.status}
                  </Badge>
                  {post.video_url && (
                    <Video className="h-3.5 w-3.5 text-muted-foreground ml-auto" />
                  )}
                  {post.image_url && !post.video_url && (
                    <ImageIcon className="h-3.5 w-3.5 text-muted-foreground ml-auto" />
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">
                    AI: {aiScores[post.id] ? `${aiScores[post.id]}%` : "Not checked"}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs ml-auto"
                    onClick={(e) => {
                      e.stopPropagation()
                      void runAiCheckForPost(post)
                    }}
                    disabled={!!checkingPostIds[post.id] || checkingAll}
                  >
                    {checkingPostIds[post.id] ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <ShieldCheck className="h-3.5 w-3.5 mr-1" />
                    )}
                    {checkingPostIds[post.id] ? "Checking" : "Check"}
                  </Button>
                </div>

                {/* Caption */}
                <p className="text-sm text-muted-foreground line-clamp-3 flex-1">
                  {post.caption ?? "(no caption)"}
                </p>

                {/* Hashtags */}
                {post.hashtags && post.hashtags.length > 0 && (
                  <p className="text-xs text-primary/70 truncate">
                    #{post.hashtags.slice(0, 5).join(" #")}
                    {post.hashtags.length > 5 && ` +${post.hashtags.length - 5} more`}
                  </p>
                )}

                {/* Schedule info */}
                {post.scheduled_date && (
                  <p className="text-xs text-muted-foreground">
                    📅 {post.scheduled_date}
                    {post.scheduled_time && ` at ${post.scheduled_time}`}
                  </p>
                )}

                {post.platform_post_id && (
                  <p className="text-xs text-muted-foreground truncate">
                    Platform ID: {post.platform_post_id}
                  </p>
                )}

                {post.publish_error && (
                  <p className="text-xs text-destructive line-clamp-2">
                    Publish error: {post.publish_error}
                  </p>
                )}

                <p className="text-xs text-muted-foreground mt-auto">Click card to open full post</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Post editor modal */}
      {selectedPost && (
        <PostEditorModal
          post={selectedPost}
          open={modalOpen}
          onOpenChange={setModalOpen}
          onSaved={handlePostSaved}
          onDeleted={handlePostDeleted}
        />
      )}
    </div>
  )
}
