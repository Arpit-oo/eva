"use client"

import { useEffect, useState, useCallback } from "react"
import { toast } from "sonner"
import { Loader2, CalendarDays, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { PostEditorModal } from "@/components/post-editor-modal"
import type { PostRow } from "@/lib/types"

import FullCalendar from "@fullcalendar/react"
import dayGridPlugin from "@fullcalendar/daygrid"
import interactionPlugin from "@fullcalendar/interaction"
import type { EventClickArg, DatesSetArg, EventContentArg } from "@fullcalendar/core"

const PLATFORM_COLORS: Record<string, string> = {
  linkedin: "#0077B5",
  instagram: "#E1306C",
  twitter: "#1DA1F2",
  facebook: "#1877F2",
  tiktok: "#69C9D0",
}

function EventContent({ eventInfo }: { eventInfo: EventContentArg }) {
  const platform = eventInfo.event.extendedProps.platform as string
  const status = eventInfo.event.extendedProps.status as string
  return (
    <div
      className="w-full overflow-hidden px-1 py-0.5 text-xs text-white rounded-sm cursor-pointer"
      style={{
        backgroundColor: PLATFORM_COLORS[platform] ?? "#6366f1",
        opacity: status === "published" ? 0.65 : 1,
        border: status === "draft" ? "1px dashed rgba(255,255,255,0.6)" : "none",
      }}
    >
      <span className="font-semibold uppercase">[{platform?.slice(0, 2)}]</span>{" "}
      <span className="truncate">{eventInfo.event.title}</span>
    </div>
  )
}

export default function CalendarPage() {
  const [posts, setPosts] = useState<PostRow[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPost, setSelectedPost] = useState<PostRow | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [dateRange, setDateRange] = useState<{ start: string; end: string } | null>(null)

  const fetchPosts = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (dateRange?.start) params.set("start_date", dateRange.start)
      if (dateRange?.end) params.set("end_date", dateRange.end)
      const res = await fetch(`/api/posts?${params.toString()}`)
      if (!res.ok) throw new Error("Failed to load posts")
      const data = await res.json()
      setPosts(data.posts ?? [])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load posts")
    } finally {
      setLoading(false)
    }
  }, [dateRange])

  useEffect(() => {
    fetchPosts()
  }, [fetchPosts])

  const handleDatesSet = useCallback((info: DatesSetArg) => {
    setDateRange({
      start: info.startStr.split("T")[0],
      end: info.endStr.split("T")[0],
    })
  }, [])

  const handleEventClick = useCallback(
    (info: EventClickArg) => {
      const post = posts.find((p) => p.id === info.event.id)
      if (post) {
        setSelectedPost(post)
        setModalOpen(true)
      }
    },
    [posts]
  )

  const handlePostSaved = useCallback((updated: PostRow) => {
    setPosts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
  }, [])

  const handlePostDeleted = useCallback((id: string) => {
    setPosts((prev) => prev.filter((p) => p.id !== id))
  }, [])

  const events = posts
    .filter((p) => p.scheduled_date)
    .map((p) => ({
      id: p.id,
      title: p.caption?.split("\n")[0]?.slice(0, 60) ?? "(no caption)",
      date: p.scheduled_date!,
      extendedProps: { platform: p.platform, status: p.status },
    }))

  const unscheduledPosts = posts.filter((p) => !p.scheduled_date)

  return (
    <div className="flex flex-col gap-6 p-6 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CalendarDays className="h-6 w-6 text-primary" />
            Content Calendar
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            All scheduled posts in one view. Click an event to edit.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchPosts} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Refresh
        </Button>
      </div>

      {/* Platform legend */}
      <div className="flex flex-wrap gap-3 text-xs">
        {Object.entries(PLATFORM_COLORS).map(([platform, color]) => (
          <span key={platform} className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: color }} />
            <span className="capitalize text-muted-foreground">
              {platform === "twitter" ? "Twitter/X" : platform}
            </span>
          </span>
        ))}
        <span className="flex items-center gap-1.5 ml-4">
          <span className="inline-block w-3 h-3 rounded-sm border border-dashed border-muted-foreground" />
          <span className="text-muted-foreground">Draft</span>
        </span>
      </div>

      {/* Calendar */}
      <div className="bg-card border rounded-xl shadow-sm p-4">
        <FullCalendar
          plugins={[dayGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          events={events}
          eventClick={handleEventClick}
          datesSet={handleDatesSet}
          eventContent={(info) => <EventContent eventInfo={info} />}
          headerToolbar={{
            left: "prev,next today",
            center: "title",
            right: "dayGridMonth,dayGridWeek",
          }}
          height="auto"
          dayMaxEvents={4}
        />
      </div>

      {/* Unscheduled drafts */}
      {unscheduledPosts.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Unscheduled Drafts ({unscheduledPosts.length})
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {unscheduledPosts.map((post) => (
              <button
                key={post.id}
                onClick={() => {
                  setSelectedPost(post)
                  setModalOpen(true)
                }}
                className="text-left bg-card border rounded-lg p-3 hover:border-primary transition-colors space-y-1.5 group"
              >
                <div className="flex items-center gap-2">
                  <Badge
                    variant="secondary"
                    className="capitalize text-xs"
                    style={{
                      backgroundColor: (PLATFORM_COLORS[post.platform] ?? "#6366f1") + "20",
                      color: PLATFORM_COLORS[post.platform] ?? "#6366f1",
                    }}
                  >
                    {post.platform}
                  </Badge>
                  <Badge variant="outline" className="text-xs capitalize">
                    {post.status}
                  </Badge>
                </div>
                <p className="text-sm line-clamp-2 text-muted-foreground group-hover:text-foreground transition-colors">
                  {post.caption?.slice(0, 100) ?? "(no caption)"}
                </p>
              </button>
            ))}
          </div>
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
