"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { toast } from "sonner"
import { Loader2, CalendarDays, RefreshCw, Clock3 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { PostEditorModal } from "@/components/post-editor-modal"
import type { PostRow } from "@/lib/types"
import { cn } from "@/lib/utils"

import FullCalendar from "@fullcalendar/react"
import dayGridPlugin from "@fullcalendar/daygrid"
import timeGridPlugin from "@fullcalendar/timegrid"
import interactionPlugin from "@fullcalendar/interaction"
import type { DateClickArg } from "@fullcalendar/interaction"
import type { EventClickArg, EventContentArg } from "@fullcalendar/core"

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
  const dotColor = PLATFORM_COLORS[platform] ?? "#5f8fff"

  return (
    <div className="flex w-full min-w-0 items-start gap-1.5 rounded-md px-1.5 py-1 text-[11px] text-foreground/90">
      <span
        className="mt-1 h-2 w-2 shrink-0 rounded-full"
        style={{
          backgroundColor: dotColor,
          boxShadow: `0 0 10px ${dotColor}66`,
          opacity: status === "published" ? 0.6 : 1,
        }}
      />
      <span className="block min-w-0 flex-1 truncate leading-snug">{eventInfo.event.title}</span>
    </div>
  )
}

function formatAgendaDate(date: string, time?: string | null) {
  const when = new Date(`${date}T${time ?? "09:00"}`)
  return when.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

function formatDateLabel(date: string) {
  const d = new Date(`${date}T00:00:00`)
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  })
}

function currentDateString() {
  const now = new Date()
  return now.toISOString().split("T")[0]
}

export default function CalendarPage() {
  const calendarRef = useRef<FullCalendar | null>(null)
  const [posts, setPosts] = useState<PostRow[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPost, setSelectedPost] = useState<PostRow | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedDate, setSelectedDate] = useState<string>(currentDateString())
  const [calendarView, setCalendarView] = useState<"dayGridMonth" | "timeGridWeek">("dayGridMonth")

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

  useEffect(() => {
    const api = calendarRef.current?.getApi()
    if (api && api.view.type !== calendarView) {
      api.changeView(calendarView)
    }
  }, [calendarView])

  const handleEventClick = useCallback(
    (info: EventClickArg) => {
      const post = posts.find((p) => p.id === info.event.id)
      if (post) {
        if (post.scheduled_date) {
          setSelectedDate(post.scheduled_date)
        }
        setSelectedPost(post)
        setModalOpen(true)
      }
    },
    [posts]
  )

  const handleDateClick = useCallback((info: DateClickArg) => {
    setSelectedDate(info.dateStr)
  }, [])

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
      start: `${p.scheduled_date}T${p.scheduled_time ?? "09:00:00"}`,
      allDay: false,
      extendedProps: { platform: p.platform, status: p.status },
    }))

  const unscheduledPosts = posts.filter((p) => !p.scheduled_date)
  const scheduledPosts = posts
    .filter((p) => p.scheduled_date)
    .sort((a, b) => {
      const left = new Date(`${a.scheduled_date}T${a.scheduled_time ?? "09:00"}`).getTime()
      const right = new Date(`${b.scheduled_date}T${b.scheduled_time ?? "09:00"}`).getTime()
      return left - right
    })

  const scheduledCount = posts.filter((p) => p.status === "scheduled").length
  const publishedCount = posts.filter((p) => p.status === "published").length
  const draftCount = posts.filter((p) => p.status === "draft").length

  const selectedDatePosts = scheduledPosts.filter((post) => post.scheduled_date === selectedDate)
  const today = currentDateString()
  const upcomingPosts = scheduledPosts.filter((post) => {
    const time = post.scheduled_time ?? "09:00"
    return new Date(`${post.scheduled_date}T${time}`).getTime() >= new Date(`${today}T00:00`).getTime()
  })

  const agendaPosts = selectedDatePosts.length > 0 ? selectedDatePosts : upcomingPosts.slice(0, 8)

  return (
    <div className="flex flex-col gap-6 p-2 md:p-0 w-full">
      {/* Header */}
      <div className="eva-surface flex items-center justify-between px-5 py-4">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2.5">
            <CalendarDays className="h-6 w-6 text-primary" />
            Content Calendar
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Monthly planner with timeline agenda. Click any event to edit the post.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="rounded-xl border border-white/10 bg-muted/60 p-1 flex items-center gap-1">
            <button
              className={cn(
                "px-3 py-1.5 text-xs rounded-lg transition",
                calendarView === "dayGridMonth"
                  ? "bg-primary text-primary-foreground shadow-[0_8px_18px_rgba(71,127,233,0.45)]"
                  : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => setCalendarView("dayGridMonth")}
            >
              Month
            </button>
            <button
              className={cn(
                "px-3 py-1.5 text-xs rounded-lg transition",
                calendarView === "timeGridWeek"
                  ? "bg-primary text-primary-foreground shadow-[0_8px_18px_rgba(71,127,233,0.45)]"
                  : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => setCalendarView("timeGridWeek")}
            >
              Week
            </button>
          </div>

          <Button variant="secondary" size="sm" onClick={fetchPosts} disabled={loading} className="rounded-xl">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="eva-surface px-4 py-3">
          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Scheduled</p>
          <p className="text-2xl font-semibold mt-1">{scheduledCount}</p>
        </div>
        <div className="eva-surface px-4 py-3">
          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Published</p>
          <p className="text-2xl font-semibold mt-1">{publishedCount}</p>
        </div>
        <div className="eva-surface px-4 py-3">
          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Drafts</p>
          <p className="text-2xl font-semibold mt-1">{draftCount}</p>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px] items-start">
        {/* Calendar */}
        <div className="eva-surface p-4 eva-calendar">
          <div className="mb-3 flex flex-wrap gap-3 text-xs">
            {Object.entries(PLATFORM_COLORS).slice(0, 4).map(([platform, color]) => (
              <span key={platform} className="flex items-center gap-1.5 rounded-full bg-muted/50 px-2.5 py-1">
                <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                <span className="capitalize text-muted-foreground">
                  {platform === "twitter" ? "Twitter/X" : platform}
                </span>
              </span>
            ))}
            <span className="flex items-center gap-1.5 rounded-full bg-muted/50 px-2.5 py-1">
              <span className="inline-block w-2 h-2 rounded-full bg-muted-foreground/70" />
              <span className="text-muted-foreground">Published dimmed</span>
            </span>
          </div>

          <FullCalendar
            ref={calendarRef}
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            events={events}
            eventClick={handleEventClick}
            dateClick={handleDateClick}
            eventContent={(info) => <EventContent eventInfo={info} />}
            headerToolbar={{
              left: "prev,next today",
              center: "title",
              right: "",
            }}
            height="auto"
            dayMaxEvents={3}
            eventMinHeight={56}
            eventShortHeight={56}
            slotEventOverlap={false}
            slotMinTime="06:00:00"
            slotMaxTime="22:00:00"
          />
        </div>

        {/* Agenda sidebar */}
        <aside className="eva-surface p-4 xl:sticky xl:top-5">
          <div className="mb-4">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Agenda</p>
            <h2 className="text-lg font-semibold mt-1">{formatDateLabel(selectedDate)}</h2>
            <p className="text-xs text-muted-foreground mt-1">
              {selectedDatePosts.length > 0
                ? `${selectedDatePosts.length} post${selectedDatePosts.length > 1 ? "s" : ""} on selected day`
                : "No posts on selected day, showing upcoming schedule"}
            </p>
          </div>

          <div className="space-y-3 pr-1">
            {agendaPosts.length === 0 && (
              <div className="rounded-2xl border border-dashed border-white/15 px-4 py-8 text-center text-sm text-muted-foreground">
                No scheduled posts in this range yet.
              </div>
            )}

            {agendaPosts.map((post) => (
              <button
                key={post.id}
                onClick={() => {
                  setSelectedPost(post)
                  setModalOpen(true)
                }}
                className="w-full text-left rounded-2xl border border-white/10 bg-card/70 px-3.5 py-3 transition hover:border-primary/50 hover:bg-card"
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <Badge
                    variant="secondary"
                    className="capitalize rounded-full"
                    style={{
                      backgroundColor: (PLATFORM_COLORS[post.platform] ?? "#6366f1") + "26",
                      color: PLATFORM_COLORS[post.platform] ?? "#6366f1",
                    }}
                  >
                    {post.platform}
                  </Badge>
                  <Badge variant="outline" className="capitalize rounded-full border-white/20 text-xs">
                    {post.status}
                  </Badge>
                </div>
                <p className="text-sm line-clamp-2 mb-2 text-foreground/95">{post.caption || "(no caption)"}</p>
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Clock3 className="h-3.5 w-3.5" />
                  {formatAgendaDate(post.scheduled_date!, post.scheduled_time)}
                </p>
              </button>
            ))}
          </div>
        </aside>
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
                className="text-left rounded-2xl border border-white/10 bg-card/70 p-3.5 hover:border-primary/55 transition-colors space-y-1.5 group"
              >
                <div className="flex items-center gap-2">
                  <Badge
                    variant="secondary"
                    className="capitalize text-xs rounded-full"
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
