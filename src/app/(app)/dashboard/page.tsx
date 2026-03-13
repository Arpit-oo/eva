"use client"

import { useEffect, useRef, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import {
  Lightbulb,
  Calendar,
  FileText,
  Send,
  Loader2,
  Trash2,
} from "lucide-react"
import type { IdeaRow, PostRow } from "@/lib/types"
import { createClient } from "@/lib/supabase/client"

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
  const [loadingData, setLoadingData] = useState(true)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    loadData()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadData() {
    setLoadingData(true)
    try {
      const [ideasRes, postsRes] = await Promise.all([
        fetch("/api/ideas"),
        supabase
          .from("Posts")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(5),
      ])

      if (ideasRes.ok) {
        const data = await ideasRes.json()
        const list: IdeaRow[] = data.ideas ?? []
        setIdeas(list)
        setStats((s) => ({ ...s, totalIdeas: list.length }))
      }

      if (!postsRes.error && postsRes.data) {
        const allPosts = postsRes.data as PostRow[]
        setRecentPosts(allPosts)
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
      toast.success("Idea saved!")
      textareaRef.current?.focus()
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

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault()
      handleSaveIdea()
    }
  }

  const statusVariant: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
    draft: "secondary",
    scheduled: "default",
    published: "outline",
    failed: "destructive",
  }

  const platformEmoji: Record<string, string> = {
    linkedin: "🔵",
    twitter: "🐦",
    instagram: "📷",
    facebook: "👍",
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back — here&apos;s your content at a glance.
        </p>
      </div>

      {/* Stats row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <Calendar className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Scheduled</p>
                <p className="text-2xl font-bold">{stats.scheduled}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                <Send className="h-4 w-4 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Published</p>
                <p className="text-2xl font-bold">{stats.published}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-yellow-100 dark:bg-yellow-900/30">
                <FileText className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Drafts</p>
                <p className="text-2xl font-bold">{stats.drafts}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                <Lightbulb className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Ideas</p>
                <p className="text-2xl font-bold">{stats.totalIdeas}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Quick Idea Capture */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Lightbulb className="h-4 w-4" />
              Quick Idea Capture
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              ref={textareaRef}
              placeholder="Jot down an idea… (⌘+Enter to save)"
              value={ideaText}
              onChange={(e) => setIdeaText(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={3}
              className="resize-none"
            />
            <Button
              onClick={handleSaveIdea}
              disabled={!ideaText.trim() || savingIdea}
              size="sm"
              className="w-full"
            >
              {savingIdea ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Lightbulb className="h-4 w-4 mr-2" />
              )}
              Save Idea
            </Button>

            <div className="space-y-2 max-h-64 overflow-y-auto">
              {loadingData && (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              )}
              {!loadingData && ideas.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No ideas yet — capture your first one!
                </p>
              )}
              {ideas.map((idea) => (
                <div
                  key={idea.id}
                  className="flex items-start justify-between gap-2 rounded-md border p-2 text-sm bg-muted/30"
                >
                  <p className="flex-1 leading-snug">{idea.idea_text}</p>
                  <button
                    onClick={() => handleDeleteIdea(idea.id)}
                    className="text-muted-foreground hover:text-destructive transition-colors shrink-0 mt-0.5"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Posts */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4" />
              Recent Posts
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingData ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : recentPosts.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No posts yet. Head to{" "}
                <a href="/generate" className="text-primary hover:underline">
                  Generate
                </a>{" "}
                to create your first.
              </p>
            ) : (
              <div className="space-y-3">
                {recentPosts.map((post) => (
                  <div
                    key={post.id}
                    className="flex items-start gap-3 border-b pb-3 last:border-0 last:pb-0"
                  >
                    <span className="text-lg leading-none mt-0.5">
                      {platformEmoji[post.platform] ?? "📄"}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate leading-snug">
                        {post.caption ?? "(no content)"}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5 capitalize">
                        {post.platform}
                      </p>
                    </div>
                    <Badge variant={statusVariant[post.status] ?? "secondary"}>
                      {post.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
