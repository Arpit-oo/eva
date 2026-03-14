"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { toast } from "sonner"
import {
  Loader2,
  CalendarDays,
  RefreshCw,
  Clock3,
  GripVertical,
  Linkedin,
  Instagram,
  Twitter,
  Facebook,
} from "lucide-react"
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
  linkedin: "#0a66c2",
  instagram: "#E1306C",
  twitter: "#1DA1F2",
  facebook: "#1877F2",
  tiktok: "#69C9D0",
}

const AGENDA_ORDER_STORAGE_KEY = "eva-calendar-agenda-order-v1"

const PLATFORM_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  linkedin: Linkedin,
  instagram: Instagram,
  twitter: Twitter,
  facebook: Facebook,
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
  const [agendaOrderMap, setAgendaOrderMap] = useState<Record<string, string[]>>({})
  const [draggingAgendaId, setDraggingAgendaId] = useState<string | null>(null)
  const [dragOverAgendaId, setDragOverAgendaId] = useState<string | null>(null)
  const [dragOverPosition, setDragOverPosition] = useState<"before" | "after">("before")

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
    try {
      const raw = window.localStorage.getItem(AGENDA_ORDER_STORAGE_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as Record<string, string[]>
      if (parsed && typeof parsed === "object") {
        setAgendaOrderMap(parsed)
      }
    } catch {
      // Ignore invalid persisted agenda order data.
    }
  }, [])

  useEffect(() => {
    try {
      window.localStorage.setItem(AGENDA_ORDER_STORAGE_KEY, JSON.stringify(agendaOrderMap))
    } catch {
      // Ignore storage write failures.
    }
  }, [agendaOrderMap])

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
  const agendaPosts = [...selectedDatePosts].sort((a, b) => {
    const order = agendaOrderMap[selectedDate] ?? []
    const aIndex = order.indexOf(a.id)
    const bIndex = order.indexOf(b.id)
    if (aIndex === -1 && bIndex === -1) return 0
    if (aIndex === -1) return 1
    if (bIndex === -1) return -1
    return aIndex - bIndex
  })

  function handleAgendaDragStart(postId: string) {
    setDraggingAgendaId(postId)
  }

  function handleAgendaDragEnd() {
    setDraggingAgendaId(null)
    setDragOverAgendaId(null)
    setDragOverPosition("before")
  }

  function handleAgendaDragOver(postId: string, event: React.DragEvent<HTMLButtonElement>) {
    event.preventDefault()
    if (!draggingAgendaId || draggingAgendaId === postId) return
    const rect = event.currentTarget.getBoundingClientRect()
    const position = event.clientY < rect.top + rect.height / 2 ? "before" : "after"
    setDragOverAgendaId(postId)
    setDragOverPosition(position)
  }

  function handleAgendaDrop(targetPostId: string, event: React.DragEvent<HTMLButtonElement>) {
    event.preventDefault()
    if (!draggingAgendaId || draggingAgendaId === targetPostId) {
      handleAgendaDragEnd()
      return
    }

    const ids = agendaPosts.map((post) => post.id)
    const fromIndex = ids.indexOf(draggingAgendaId)
    const targetIndex = ids.indexOf(targetPostId)
    if (fromIndex === -1 || targetIndex === -1) {
      handleAgendaDragEnd()
      return
    }

    const reordered = [...ids]
    reordered.splice(fromIndex, 1)
    let insertIndex = dragOverPosition === "after" ? targetIndex + 1 : targetIndex
    if (fromIndex < insertIndex) insertIndex -= 1
    reordered.splice(insertIndex, 0, draggingAgendaId)

    setAgendaOrderMap((prev) => ({
      ...prev,
      [selectedDate]: reordered,
    }))
    handleAgendaDragEnd()
  }

  return (
    <div className="calendar-page flex flex-col gap-6 p-2 md:p-0 w-full">
      {/* Header */}
      <div className="calendar-header-card flex items-center justify-between px-5 py-4">
        <div>
          <h1 className="calendar-header-title text-2xl font-semibold flex items-center gap-2.5">
            <CalendarDays className="h-6 w-6 text-primary" />
            Content Calendar
          </h1>
          <p className="calendar-header-subtitle text-muted-foreground text-sm mt-1">
            Monthly planner with timeline agenda. Click any event to edit the post.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="calendar-view-toggle rounded-xl border border-white/10 bg-muted/60 p-1 flex items-center gap-1">
            <button
              className={cn(
                "px-3 py-1.5 text-xs rounded-lg transition calendar-view-toggle-btn",
                calendarView === "dayGridMonth"
                  ? "calendar-view-toggle-btn-active"
                  : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => setCalendarView("dayGridMonth")}
            >
              Month
            </button>
            <button
              className={cn(
                "px-3 py-1.5 text-xs rounded-lg transition calendar-view-toggle-btn",
                calendarView === "timeGridWeek"
                  ? "calendar-view-toggle-btn-active"
                  : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => setCalendarView("timeGridWeek")}
            >
              Week
            </button>
          </div>

          <Button variant="secondary" size="sm" onClick={fetchPosts} disabled={loading} className="rounded-xl calendar-refresh-btn">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="calendar-stat-card stat-accent-blue px-4 py-3">
          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Scheduled</p>
          <p className="text-2xl font-semibold mt-1">{scheduledCount}</p>
        </div>
        <div className="calendar-stat-card stat-accent-green px-4 py-3">
          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Published</p>
          <p className="text-2xl font-semibold mt-1">{publishedCount}</p>
        </div>
        <div className="calendar-stat-card stat-accent-amber px-4 py-3">
          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Drafts</p>
          <p className="text-2xl font-semibold mt-1">{draftCount}</p>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px] items-start">
        {/* Calendar */}
        <div className="calendar-grid-shell p-4 eva-calendar">
          <div className="calendar-filter-bar mb-3 flex flex-wrap gap-3 text-xs">
            {Object.entries(PLATFORM_COLORS).slice(0, 4).map(([platform, color]) => (
              <span
                key={platform}
                data-platform={platform}
                className="calendar-filter-chip flex items-center gap-1.5 rounded-full bg-muted/50 px-2.5 py-1"
              >
                {(() => {
                  const Icon = PLATFORM_ICON[platform]
                  return Icon ? (
                    <span style={{ color }}>
                      <Icon className="h-3 w-3" />
                    </span>
                  ) : (
                    <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                  )
                })()}
                <span className="calendar-filter-chip-label capitalize text-muted-foreground">
                  {platform === "twitter" ? "Twitter/X" : platform}
                </span>
              </span>
            ))}
            <span className="calendar-filter-chip calendar-filter-chip-dim flex items-center gap-1.5 rounded-full bg-muted/50 px-2.5 py-1">
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
            dayCellClassNames={(arg) => {
              const classes: string[] = []
              if (arg.date.toISOString().split("T")[0] === selectedDate) {
                classes.push("fc-day-selected")
              }
              return classes
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
        <aside className="calendar-agenda-panel p-4 xl:sticky xl:top-5">
          <div className="mb-4">
            <p className="calendar-agenda-label text-xs uppercase tracking-[0.18em] text-muted-foreground">Agenda</p>
            <h2 className="calendar-agenda-title text-lg font-semibold mt-1">{formatDateLabel(selectedDate)}</h2>
            <p className="text-xs text-muted-foreground mt-1">
              {selectedDatePosts.length > 0
                ? `${selectedDatePosts.length} post${selectedDatePosts.length > 1 ? "s" : ""} on selected day`
                : "No posts on selected day"}
            </p>
          </div>

          <div className="space-y-3 pr-1">
            {agendaPosts.length === 0 && (
              <div className="rounded-2xl border border-dashed border-white/20 bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
                No posts today.
              </div>
            )}

            {agendaPosts.map((post) => (
              <button
                key={post.id}
                draggable
                onDragStart={(event) => {
                  handleAgendaDragStart(post.id)
                  event.dataTransfer.effectAllowed = "move"
                  event.dataTransfer.setData("text/plain", post.id)
                }}
                onDragEnd={handleAgendaDragEnd}
                onDragOver={(event) => handleAgendaDragOver(post.id, event)}
                onDrop={(event) => handleAgendaDrop(post.id, event)}
                onClick={() => {
                  setSelectedPost(post)
                  setModalOpen(true)
                }}
                className={cn(
                  "calendar-agenda-card relative w-full text-left rounded-2xl border border-white/10 bg-card/70 px-3.5 py-3 transition-all duration-150",
                  draggingAgendaId === post.id && "opacity-50 cursor-grabbing"
                )}
                style={{
                  borderLeft: `3px solid ${PLATFORM_COLORS[post.platform] ?? "#5f8fff"}`,
                }}
              >
                {dragOverAgendaId === post.id && draggingAgendaId && draggingAgendaId !== post.id && dragOverPosition === "before" && (
                  <span className="pointer-events-none absolute left-2 right-2 top-0 h-[2px] rounded-[1px] bg-[#6366f1]" />
                )}
                {dragOverAgendaId === post.id && draggingAgendaId && draggingAgendaId !== post.id && dragOverPosition === "after" && (
                  <span className="pointer-events-none absolute left-2 right-2 bottom-0 h-[2px] rounded-[1px] bg-[#6366f1]" />
                )}
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <GripVertical className="agenda-drag-handle h-3.5 w-3.5 shrink-0 cursor-grab" />
                    <Badge
                      variant="secondary"
                      className="calendar-platform-badge capitalize rounded-full"
                      data-platform={post.platform}
                      style={{
                        backgroundColor: (PLATFORM_COLORS[post.platform] ?? "#6366f1") + "26",
                        color: PLATFORM_COLORS[post.platform] ?? "#6366f1",
                      }}
                    >
                      {post.platform}
                    </Badge>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn(
                      "capitalize text-xs rounded-md",
                      post.status === "draft" && "calendar-status-draft",
                      post.status === "failed" && "calendar-status-failed",
                      post.status === "published" && "calendar-status-published"
                    )}
                  >
                    {post.status}
                  </Badge>
                </div>
                <p className="calendar-agenda-caption text-sm line-clamp-2 mb-2 text-foreground/95">{post.caption || "(no caption)"}</p>
                <p className="calendar-agenda-time text-xs text-primary flex items-center gap-1.5 font-medium">
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
          <h2 className="calendar-unscheduled-title text-sm font-semibold text-muted-foreground uppercase tracking-wide">
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
                className="calendar-draft-card text-left rounded-2xl border border-white/10 p-4 transition-all duration-200 space-y-0 group overflow-hidden"
                style={{
                  borderLeft: `3px solid ${PLATFORM_COLORS[post.platform] ?? "#5f8fff"}`,
                }}
              >
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="secondary"
                      className="calendar-platform-badge capitalize text-xs rounded-full"
                      data-platform={post.platform}
                      style={{
                        backgroundColor: (PLATFORM_COLORS[post.platform] ?? "#6366f1") + "20",
                        color: PLATFORM_COLORS[post.platform] ?? "#6366f1",
                      }}
                    >
                      {post.platform}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-xs capitalize rounded-md",
                        post.status === "failed" && "calendar-status-failed",
                        post.status === "published" && "calendar-status-published",
                        post.status === "draft" && "calendar-status-draft"
                      )}
                    >
                      {post.status}
                    </Badge>
                  </div>
                  <p className="calendar-draft-caption text-sm line-clamp-2 text-muted-foreground group-hover:text-foreground transition-colors">
                    {post.caption?.slice(0, 100) ?? "(no caption)"}
                  </p>
                </div>
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
