"use client"

import { useEffect, useState, useCallback } from "react"
import { toast } from "sonner"
import {
  Loader2,
  Library,
  RefreshCw,
  Pencil,
  Search,
  Filter,
  ImageIcon,
  Video,
  SlidersHorizontal,
  Linkedin,
  Instagram,
  Twitter,
  Facebook,
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
import { cn } from "@/lib/utils"

const PLATFORM_COLORS: Record<string, string> = {
  linkedin: "#0a66c2",
  instagram: "#E1306C",
  twitter: "#1DA1F2",
  facebook: "#1877F2",
  tiktok: "#69C9D0",
}

const PLATFORM_WATERMARK_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  linkedin: Linkedin,
  instagram: Instagram,
  twitter: Twitter,
  facebook: Facebook,
}

const PLATFORM_BANNERS: Record<string, string> = {
  instagram: "linear-gradient(135deg, #e1306c, #f77737)",
  linkedin: "linear-gradient(135deg, #0a66c2, #0077b5)",
  twitter: "linear-gradient(135deg, #1da1f2, #0d8ecf)",
  facebook: "linear-gradient(135deg, #1877f2, #166fe5)",
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

  const fetchPosts = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/posts")
      if (!res.ok) throw new Error("Failed to load posts")
      const data = await res.json()
      setPosts(data.posts ?? [])
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

  const platforms = Array.from(new Set(posts.map((p) => p.platform)))

  return (
    <div className="library-page flex flex-col gap-6 p-2 md:p-0 w-full">
      {/* Header */}
      <div className="library-header-card flex items-center justify-between px-5 py-4">
        <div>
          <h1 className="library-header-title text-2xl font-semibold flex items-center gap-2">
            <Library className="h-6 w-6 text-primary" />
            Post Library
          </h1>
          <p className="library-header-subtitle text-muted-foreground text-sm mt-0.5">
            All your generated and saved posts in one place.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchPosts} disabled={loading} className="library-refresh-btn">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <div className="library-filter-bar flex flex-wrap gap-3 items-center px-4 py-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search captions, hashtags..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 eva-input library-search-input"
          />
        </div>
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
          <Select value={filterPlatform} onValueChange={setFilterPlatform}>
            <SelectTrigger className="w-36 rounded-xl bg-muted/60 border-white/10 library-filter-select">
              <SelectValue placeholder="Platform" />
            </SelectTrigger>
            <SelectContent className="library-filter-menu">
              <SelectItem value="all">All Platforms</SelectItem>
              {platforms.map((p) => (
                <SelectItem key={p} value={p} className="capitalize">
                  {p === "twitter" ? "Twitter/X" : p.charAt(0).toUpperCase() + p.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-32 rounded-xl bg-muted/60 border-white/10 library-filter-select">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent className="library-filter-menu">
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="scheduled">Scheduled</SelectItem>
              <SelectItem value="published">Published</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <span className="library-post-count text-xs text-muted-foreground ml-auto">
          {filtered.length} post{filtered.length !== 1 ? "s" : ""}
        </span>
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
              className="library-post-card rounded-2xl overflow-hidden flex flex-col group"
              data-platform={post.platform}
              style={{
                borderTop: `3px solid ${PLATFORM_COLORS[post.platform] ?? "#6366f1"}`,
                borderRadius: "16px",
                overflow: "hidden",
              }}
            >
              {/* Image thumbnail */}
              {post.image_url && (
                <div className="relative">
                  <span
                    className="absolute top-0 left-0 right-0 z-[1] h-1"
                    style={{ background: PLATFORM_COLORS[post.platform] ?? "#6366f1" }}
                  />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={post.image_url}
                    alt=""
                    className="w-full aspect-video object-cover"
                  />
                </div>
              )}

              {!post.image_url && (
                <div
                  className="h-14 w-full"
                  style={{
                    background: PLATFORM_BANNERS[post.platform] ?? "linear-gradient(135deg, #6366f1, #8b5cf6)",
                    borderRadius: "12px 12px 0 0",
                    opacity: 0.9,
                    position: "relative",
                    zIndex: 1,
                  }}
                />
              )}

              <div className="p-4 flex flex-col gap-2 flex-1 relative z-[1]">
                {/* Platform + status */}
                <div className="flex items-center gap-2">
                  <Badge
                    variant="secondary"
                    className="library-platform-badge capitalize text-xs rounded-full"
                    data-platform={post.platform}
                  >
                    {post.platform === "twitter" ? "Twitter/X" : post.platform}
                  </Badge>
                  <Badge
                    variant={STATUS_VARIANTS[post.status] ?? "outline"}
                    className={cn(
                      "library-status-badge capitalize text-xs rounded-full",
                      post.status === "draft" && "library-status-draft"
                    )}
                  >
                    {post.status}
                  </Badge>
                  {post.video_url && (
                    <Video className="h-3.5 w-3.5 text-muted-foreground ml-auto" />
                  )}
                  {post.image_url && !post.video_url && (
                    <ImageIcon className="h-3.5 w-3.5 text-muted-foreground ml-auto" />
                  )}
                </div>

                {/* Caption */}
                <p className="library-post-caption text-sm text-muted-foreground line-clamp-3 flex-1">
                  {post.caption ?? "(no caption)"}
                </p>

                {/* Hashtags */}
                {post.hashtags && post.hashtags.length > 0 && (
                  <p className="library-post-hashtags text-xs text-primary/70 truncate">
                    #{post.hashtags.slice(0, 5).map((tag) => String(tag).replace(/^#+/, "")).join(" #")}
                    {post.hashtags.length > 5 && ` +${post.hashtags.length - 5} more`}
                  </p>
                )}

                {/* Schedule info */}
                {post.scheduled_date && (
                  <p className="library-post-timestamp text-xs text-muted-foreground">
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

                {/* Edit button */}
                <Button
                  variant="outline"
                  size="sm"
                  className="library-edit-btn mt-auto gap-1.5 w-full"
                  onClick={() => {
                    setSelectedPost(post)
                    setModalOpen(true)
                  }}
                >
                  <Pencil className="h-[15px] w-[15px] text-white" />
                  Edit Post
                </Button>
              </div>

              {(() => {
                const WatermarkIcon = PLATFORM_WATERMARK_ICON[post.platform]
                if (!WatermarkIcon) return null
                return (
                  <WatermarkIcon
                    className="library-platform-watermark pointer-events-none absolute bottom-[14px] right-[14px] h-12 w-12 z-0"
                    data-platform={post.platform}
                  />
                )
              })()}
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
