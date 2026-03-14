"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import catSleepIcon from "../../../../iconn/catsleep.jpg"
import {
  Lightbulb,
  CalendarDays,
  FileText,
  Loader2,
  Trash2,
  ArrowUpRight,
  Clock3,
} from "lucide-react"
import type { IdeaRow, PostRow } from "@/lib/types"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import { CatLoader } from "@/components/ui/cat-loader"

const WEEK_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

function getWeekStart(date = new Date()) {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function toDateKey(date: Date) {
  return date.toISOString().split("T")[0]
}

function formatAgendaTime(post: PostRow) {
  if (!post.scheduled_date) return "Draft"
  const stamp = new Date(`${post.scheduled_date}T${post.scheduled_time ?? "09:00:00"}`)
  return stamp.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

export default function DashboardPage() {
  const supabase = createClient()

  const [ideas, setIdeas] = useState<IdeaRow[]>([])
  const [ideaText, setIdeaText] = useState("")
  const [savingIdea, setSavingIdea] = useState(false)
  const [stats, setStats] = useState({
    scheduled: 0,
    published: 0,
    drafts: 0,
    totalIdeas: 0,
  })
  const [recentPosts, setRecentPosts] = useState<PostRow[]>([])
  const [allPosts, setAllPosts] = useState<PostRow[]>([])
  const [loadingData, setLoadingData] = useState(true)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    loadData()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadData() {
    setLoadingData(true)
    try {
      const [
        ideasRes,
        postsRes,
        {
          data: { user },
        },
      ] = await Promise.all([
        fetch("/api/ideas"),
        supabase
          .from("Posts")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(60),
        supabase.auth.getUser(),
      ])

      if (user) {
        const { data: userData } = await supabase
          .from("Users")
          .select("name")
          .eq("id", user.id)
          .single()
        void userData // name shown in header, not dashboard
      }

      if (ideasRes.ok) {
        const data = await ideasRes.json()
        const list: IdeaRow[] = data.ideas ?? []
        setIdeas(list)
        setStats((s) => ({ ...s, totalIdeas: list.length }))
      }

      if (!postsRes.error && postsRes.data) {
        const allPosts = postsRes.data as PostRow[]
        setAllPosts(allPosts)
        setRecentPosts(allPosts.slice(0, 8))
        setStats((s) => ({
          ...s,
          scheduled: allPosts.filter((p) => p.status === "scheduled").length,
          published: allPosts.filter((p) => p.status === "published").length,
          drafts: allPosts.filter((p) => p.status === "draft").length,
        }))
      }
    } catch {
      toast.error("Failed to load dashboard data")
    } finally {
      setLoadingData(false)
    }
  }

  async function handleSaveIdea() {
    if (!ideaText.trim()) return
    setSavingIdea(true)
    try {
      const res = await fetch("/api/ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idea_text: ideaText }),
      })
      if (!res.ok) throw new Error("Failed to save")
      const data = await res.json()
      setIdeas((prev) => [data.idea, ...prev].slice(0, 20))
      setStats((s) => ({ ...s, totalIdeas: s.totalIdeas + 1 }))
      setIdeaText("")
      toast("Idea saved!", {
        description: "Your idea has been captured and saved.",
        action: { label: "View", onClick: () => (window.location.href = "/library") },
      })
      inputRef.current?.focus()
    } catch {
      toast.error("Failed to save idea")
    } finally {
      setSavingIdea(false)
    }
  }

  async function handleDeleteIdea(id: string) {
    if (!confirm("Delete this idea?")) return
    try {
      const res = await fetch("/api/ideas", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      })
      if (!res.ok) throw new Error("Delete failed")
      setIdeas((prev) => prev.filter((i) => i.id !== id))
      setStats((s) => ({ ...s, totalIdeas: Math.max(0, s.totalIdeas - 1) }))
      toast.success("Idea deleted")
    } catch {
      toast.error("Failed to delete idea")
    }
  }

  const PLATFORM_COLORS: Record<string, { border: string; bg: string; text: string }> = {
    linkedin:  { border: "#0A66C2", bg: "var(--plat-linkedin-bg)",  text: "var(--plat-linkedin-text)" },
    twitter:   { border: "#1DA1F2", bg: "var(--plat-twitter-bg)",   text: "var(--plat-twitter-text)" },
    instagram: { border: "#E1306C", bg: "var(--plat-instagram-bg)", text: "var(--plat-instagram-text)" },
    facebook:  { border: "#1877F2", bg: "var(--plat-facebook-bg)",  text: "var(--plat-facebook-text)" },
  }
  const PLATFORM_FALLBACK = { border: "#6b7280", bg: "rgba(107,114,128,0.15)", text: "#9ca3af" }

  const weekStart = getWeekStart()
  const weekCells = WEEK_LABELS.map((label, i) => {
    const date = new Date(weekStart)
    date.setDate(date.getDate() + i)
    const key = toDateKey(date)
    const count = allPosts.filter((post) => post.scheduled_date === key).length
    return {
      key,
      label,
      day: date.getDate(),
      count,
      isToday: key === toDateKey(new Date()),
    }
  })

  const topIdeaChips = ideas.slice(0, 10)

  const statCards = [
    { label: "Scheduled Posts", value: stats.scheduled, delta: "+3 this week",                    accentColor: "#3b82f6" },
    { label: "Published",       value: stats.published, delta: "+2 this week",                    accentColor: "#22c55e" },
    { label: "Drafts",          value: stats.drafts,    delta: `${stats.totalIdeas} ideas captured`, accentColor: "#f59e0b" },
  ]

  if (loadingData && recentPosts.length === 0 && ideas.length === 0) {
    return (
      <div className="h-[50vh] flex items-center justify-center text-muted-foreground">
        <CatLoader />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Hero CTA banner */}
      <div
        className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
        style={{
          background: "var(--generate-banner-bg)",
          border: "1px solid var(--generate-banner-border)",
          borderRadius: "16px",
          padding: "20px 24px",
          boxShadow: "var(--generate-banner-shadow)",
        }}
      >
        <div>
          <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary-color)" }}>Ready to plan your week?</h2>
          <p className="mt-1 text-sm" style={{ color: "var(--text-muted-color)" }}>Generate 7 posts with one click</p>
        </div>
        <Link href="/generate">
          <button
            onClick={() =>
              toast("Generating your week...", {
                description: "EVA is creating your content strategy.",
              })
            }
            className="calendar-refresh-btn flex items-center gap-2 shrink-0 px-4 py-2"
            style={{ color: "#ffffff" }}
          >
            <Image src={catSleepIcon} alt="Cat sleep" width={16} height={16} className="rounded-sm object-cover" />
            Generate This Week
          </button>
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {statCards.map((card) => (
          <div
            key={card.label}
            className="rounded-2xl px-6 py-5 transition-colors hover:bg-[rgba(255,255,255,0.07)]"
            style={{
              background: "var(--stat-card-bg)",
              border: "1px solid var(--surface-border)",
              borderLeft: `3px solid ${card.accentColor}`,
            }}
          >
            <p className="text-[11px] uppercase tracking-widest text-muted-foreground">{card.label}</p>
            <p className="mt-1 text-[36px] font-semibold leading-none">{card.value}</p>
            <p className="mt-1 text-xs" style={{ color: card.accentColor }}>{card.delta}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-5">
          <Card className="eva-surface">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Lightbulb className="h-4 w-4 text-primary" />
                Quick Idea Capture
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div
                className="flex h-12 items-center gap-2 rounded-xl px-3"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
              >
                <Lightbulb className="h-4 w-4 shrink-0 text-muted-foreground" />
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Capture an idea... (Enter to save)"
                  value={ideaText}
                  onChange={(e) => setIdeaText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleSaveIdea() } }}
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
                />
                <Button
                  onClick={handleSaveIdea}
                  disabled={!ideaText.trim() || savingIdea}
                  size="sm"
                  className="h-7 shrink-0 rounded-lg px-3 text-xs"
                >
                  {savingIdea ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save Idea"}
                </Button>
              </div>

              <div className="flex flex-wrap gap-2 max-h-28 overflow-y-auto pr-1 recent-posts-scroll">
                {topIdeaChips.length === 0 && (
                  <p className="text-xs text-muted-foreground">No ideas yet. Capture your first one.</p>
                )}
                {topIdeaChips.map((idea) => (
                  <span
                    key={idea.id}
                    className="inline-flex items-center gap-1 rounded-[20px] border px-[10px] py-1 text-[12px]"
                    style={{
                      background: "var(--idea-chip-bg)",
                      borderColor: "var(--idea-chip-border)",
                      color: "var(--idea-chip-text)",
                    }}
                  >
                    <span className="max-w-[180px] truncate">{idea.idea_text}</span>
                    <button
                      onClick={() => handleDeleteIdea(idea.id)}
                      style={{ color: "var(--idea-chip-text)", opacity: 0.7 }}
                      aria-label="Delete idea"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="eva-surface">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-4 w-4 text-primary" />
                Recent Posts
              </CardTitle>
            </CardHeader>
            <CardContent>
              {recentPosts.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No posts yet. Create your first post in{" "}
                  <Link href="/generate" className="text-primary hover:underline">
                    Generate
                  </Link>
                  .
                </p>
              ) : (
                <div className="space-y-2.5 max-h-[340px] overflow-y-auto pr-1 recent-posts-scroll">
                  {recentPosts.map((post) => {
                    const plat = PLATFORM_COLORS[post.platform] ?? PLATFORM_FALLBACK
                    const statusStyle =
                      post.status === "published"
                        ? { background: "rgba(34,197,94,0.1)", color: "#22c55e" }
                        : post.status === "draft"
                        ? { background: "var(--status-draft-bg)", color: "var(--status-draft-text)", borderRadius: "6px", padding: "2px 8px" }
                        : { background: "rgba(59,130,246,0.15)", color: "#3b82f6" }
                    return (
                      <article
                        key={post.id}
                        className="rounded-xl px-3 py-3 transition-all duration-150 hover:-translate-y-0.5"
                        style={{
                          background: "var(--post-card-bg)",
                          borderTop: "1px solid var(--post-card-border)",
                          borderRight: "1px solid var(--post-card-border)",
                          borderBottom: "1px solid var(--post-card-border)",
                          borderLeft: `3px solid ${plat.border}`,
                        }}
                        onMouseEnter={(e) => {
                          const el = e.currentTarget
                          el.style.borderTopColor = "var(--post-card-hover-border)"
                          el.style.borderRightColor = "var(--post-card-hover-border)"
                          el.style.borderBottomColor = "var(--post-card-hover-border)"
                        }}
                        onMouseLeave={(e) => {
                          const el = e.currentTarget
                          el.style.borderTopColor = "var(--post-card-border)"
                          el.style.borderRightColor = "var(--post-card-border)"
                          el.style.borderBottomColor = "var(--post-card-border)"
                        }}
                      >
                        <p className="text-sm line-clamp-2 text-foreground/95 mb-2.5">{post.caption ?? "(no content)"}</p>
                        <div className="flex items-center gap-2">
                          <span
                            className="shrink-0 rounded-full px-2 py-0.5 capitalize"
                            style={{ background: plat.bg, color: plat.text, fontSize: "12px", fontWeight: 500 }}
                          >
                            {post.platform}
                          </span>
                          <span className="flex flex-1 items-center gap-1 text-xs min-w-0" style={{ color: "var(--timestamp-color)" }}>
                            <Clock3 className="h-3 w-3 shrink-0" />
                            <span className="truncate">{formatAgendaTime(post)}</span>
                          </span>
                          <span
                            className="shrink-0 rounded-full px-2 py-0.5 text-[11px] capitalize"
                            style={statusStyle}
                          >
                            {post.status}
                          </span>
                        </div>
                      </article>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card
          className="h-fit"
          style={{
            background: "var(--snapshot-card-bg)",
            border: "1px solid var(--surface-border)",
            borderRadius: "16px",
          }}
        >
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarDays className="h-4 w-4 text-primary" />
              This Week Snapshot
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">Posts by day. Tap any day in Calendar for details.</p>
            <div className="grid grid-cols-7 gap-1.5">
              {weekCells.map((cell) => (
                <div
                  key={cell.key}
                  className={cn(
                    "rounded-xl border border-white/10 bg-muted/35 px-1.5 py-2 text-center",
                    cell.isToday && "border-primary/60"
                  )}
                >
                  <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{cell.label}</p>
                  <p
                    className={cn(
                      "mt-0.5 text-sm font-semibold",
                      cell.isToday && "mx-auto flex h-6 w-6 items-center justify-center rounded-full bg-[#3b82f6] text-white"
                    )}
                  >
                    {cell.day}
                  </p>
                  <div className="mt-1 flex justify-center gap-1">
                    {Array.from({ length: Math.min(cell.count, 3) }).map((_, i) => (
                      <span key={i} className="h-1.5 w-1.5 rounded-full bg-primary/90" />
                    ))}
                    {cell.count === 0 && <span className="h-1.5 w-1.5 rounded-full bg-white/20" />}
                  </div>
                </div>
              ))}
            </div>
            <div className="rounded-xl border border-white/10 bg-muted/30 p-3">
              <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground">Upcoming</p>
              <p className="mt-1 text-sm font-medium">{stats.scheduled} scheduled this cycle</p>
              <Link href="/calendar" className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80">
                Open calendar
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
