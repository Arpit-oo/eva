"use client"

import { useEffect, useState, useCallback } from "react"
import { toast } from "sonner"
import {
  Loader2,
  LayoutTemplate,
  RefreshCw,
  Copy,
  Trash2,
  Search,
  Sparkles,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card"

interface TemplateRow {
  id: string
  user_id: string
  template_name: string | null
  caption: string | null
  hashtags: string[] | null
  image_prompt: string | null
  created_at: string
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<TemplateRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [copying, setCopying] = useState<string | null>(null)

  const fetchTemplates = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/templates")
      if (!res.ok) throw new Error("Failed to load templates")
      const data = await res.json()
      setTemplates(data.templates ?? [])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load templates")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTemplates()
  }, [fetchTemplates])

  const handleDelete = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/templates/${id}`, { method: "DELETE" })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? "Delete failed")
      }
      setTemplates((prev) => prev.filter((t) => t.id !== id))
      toast.success("Template deleted")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed")
    }
  }, [])

  const handleCopyToClipboard = useCallback(async (t: TemplateRow) => {
    setCopying(t.id)
    try {
      const parts: string[] = []
      if (t.caption) parts.push(t.caption)
      if (t.hashtags && t.hashtags.length > 0) {
        parts.push("\n" + t.hashtags.map((h) => `#${h}`).join(" "))
      }
      await navigator.clipboard.writeText(parts.join("\n"))
      toast.success("Copied to clipboard")
    } catch {
      toast.error("Failed to copy")
    } finally {
      setCopying(null)
    }
  }, [])

  const filtered = templates.filter((t) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      t.template_name?.toLowerCase().includes(q) ||
      t.caption?.toLowerCase().includes(q) ||
      t.hashtags?.some((h) => h.toLowerCase().includes(q))
    )
  })

  return (
    <div className="flex flex-col gap-6 p-2 md:p-0 w-full">
      {/* Header */}
      <div className="eva-surface flex items-center justify-between px-5 py-4">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <LayoutTemplate className="h-6 w-6 text-primary" />
            Templates
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Reusable content frameworks. Save posts as templates from the post editor.
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={fetchTemplates} disabled={loading} className="rounded-xl">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          <span className="hidden sm:inline">Refresh</span>
        </Button>
      </div>

      {/* Search */}
      {templates.length > 0 && (
        <div className="eva-surface relative max-w-md px-3 py-2.5">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search templates..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 eva-input"
          />
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="eva-surface flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
          <LayoutTemplate className="h-12 w-12 opacity-25" />
          <p className="text-sm font-medium">
            {templates.length === 0
              ? "No templates yet"
              : "No templates match your search"}
          </p>
          {templates.length === 0 && (
            <p className="text-xs text-center max-w-xs">
              Open any post in the Library or Generate page and click{" "}
              <span className="font-medium">Save as Template</span> to create a reusable framework.
            </p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((t) => (
            <Card key={t.id} className="eva-elevated flex flex-col rounded-2xl">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base line-clamp-1">
                  {t.template_name ?? "Untitled Template"}
                  </CardTitle>
                  <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                    {new Date(t.created_at).toLocaleDateString()}
                  </span>
                </div>
              </CardHeader>

              <CardContent className="flex flex-col gap-3 flex-1">
                {/* Caption */}
                {t.caption && (
                  <p className="text-sm text-muted-foreground line-clamp-4">
                    {t.caption}
                  </p>
                )}

                {/* Hashtags */}
                {t.hashtags && t.hashtags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {t.hashtags.slice(0, 8).map((h) => (
                      <Badge key={h} variant="secondary" className="text-xs">
                        #{h}
                      </Badge>
                    ))}
                    {t.hashtags.length > 8 && (
                      <Badge variant="outline" className="text-xs">
                        +{t.hashtags.length - 8}
                      </Badge>
                    )}
                  </div>
                )}

                {/* Image prompt */}
                {t.image_prompt && (
                  <div className="flex items-start gap-1.5 rounded-xl bg-muted/60 border border-white/10 px-2.5 py-2">
                    <Sparkles className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                    <p className="text-xs text-muted-foreground line-clamp-2">{t.image_prompt}</p>
                  </div>
                )}
              </CardContent>

              <CardFooter className="pt-3 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 gap-1.5 rounded-xl"
                  onClick={() => handleCopyToClipboard(t)}
                  disabled={copying === t.id}
                >
                  {copying === t.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                  Copy
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  className="rounded-xl text-destructive hover:text-destructive"
                  onClick={() => {
                    if (confirm("Delete this template? This cannot be undone.")) {
                      handleDelete(t.id)
                    }
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
