"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import { Plus, Pencil, Trash2, Copy, Loader2, Star } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import type { BrandProfileRow } from "@/lib/types"

const TONES = [
  "Professional",
  "Casual",
  "Inspirational",
  "Educational",
  "Humorous",
  "Authoritative",
]
const FREQUENCIES = ["daily", "3x_week", "weekly", "biweekly"]
const FREQUENCY_LABELS: Record<string, string> = {
  daily: "Daily",
  "3x_week": "3× / week",
  weekly: "Weekly",
  biweekly: "Bi-weekly",
}

interface ProfileFormData {
  brand_name: string
  industry: string
  tone: string
  audience: string
  posting_frequency: string
  keywords: string[]
}

const empty: ProfileFormData = {
  brand_name: "",
  industry: "",
  tone: "Professional",
  audience: "",
  posting_frequency: "daily",
  keywords: [],
}

export default function SettingsPage() {
  const supabase = createClient()
  const [profiles, setProfiles] = useState<BrandProfileRow[]>([])
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null)
  const [telegramToken, setTelegramToken] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<ProfileFormData>(empty)
  const [keywordInput, setKeywordInput] = useState("")
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadData() {
    setLoading(true)
    const [profilesRes, userRes] = await Promise.all([
      fetch("/api/brand-profiles"),
      supabase.from("Users").select("active_brand_profile_id, telegram_link_token").single(),
    ])
    if (profilesRes.ok) {
      const data = await profilesRes.json()
      setProfiles(data.profiles ?? [])
    }
    if (!userRes.error && userRes.data) {
      setActiveProfileId(userRes.data.active_brand_profile_id)
      setTelegramToken(userRes.data.telegram_link_token)
    }
    setLoading(false)
  }

  function openCreate() {
    setEditingId(null)
    setForm(empty)
    setKeywordInput("")
    setDialogOpen(true)
  }

  function openEdit(p: BrandProfileRow) {
    setEditingId(p.id)
    setForm({
      brand_name: p.brand_name,
      industry: p.industry ?? "",
      tone: p.tone ?? "Professional",
      audience: p.audience ?? "",
      posting_frequency: p.posting_frequency ?? "daily",
      keywords: (p.keywords as string[]) ?? [],
    })
    setKeywordInput("")
    setDialogOpen(true)
  }

  function addKeyword() {
    const kw = keywordInput.trim()
    if (!kw || form.keywords.includes(kw)) return
    setForm((f) => ({ ...f, keywords: [...f.keywords, kw] }))
    setKeywordInput("")
  }

  function removeKeyword(kw: string) {
    setForm((f) => ({ ...f, keywords: f.keywords.filter((k) => k !== kw) }))
  }

  async function handleSave() {
    if (!form.brand_name.trim()) {
      toast.error("Brand name is required")
      return
    }
    setSaving(true)
    try {
      if (editingId) {
        const res = await fetch(`/api/brand-profiles/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        })
        if (!res.ok) throw new Error()
        const data = await res.json()
        setProfiles((prev) =>
          prev.map((p) => (p.id === editingId ? data.profile : p))
        )
        toast.success("Brand profile updated")
      } else {
        const res = await fetch("/api/brand-profiles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        })
        if (!res.ok) throw new Error()
        const data = await res.json()
        setProfiles((prev) => [...prev, data.profile])
        setActiveProfileId(data.profile.id)
        toast.success("Brand profile created")
      }
      setDialogOpen(false)
    } catch {
      toast.error("Failed to save profile")
    } finally {
      setSaving(false)
    }
  }

  async function handleSetActive(id: string) {
    await supabase.from("Users").update({ active_brand_profile_id: id }).eq("id", (await supabase.auth.getUser()).data.user!.id)
    setActiveProfileId(id)
    toast.success("Active profile updated")
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/brand-profiles/${id}`, { method: "DELETE" })
    if (res.ok) {
      setProfiles((prev) => prev.filter((p) => p.id !== id))
      if (activeProfileId === id) setActiveProfileId(null)
      toast.success("Profile deleted")
    } else {
      toast.error("Failed to delete")
    }
  }

  function copyToken() {
    if (telegramToken) {
      navigator.clipboard.writeText(telegramToken)
      toast.success("Token copied!")
    }
  }

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage brand profiles and integrations.</p>
      </div>

      {/* Brand Profiles */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle id="profile">Brand Profiles</CardTitle>
            <CardDescription>
              Each profile has its own voice, tone, and content strategy.
            </CardDescription>
          </div>
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1" />
            New Profile
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : profiles.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              No brand profiles yet. Create one to get started.
            </p>
          ) : (
            <div className="space-y-3">
              {profiles.map((p) => (
                <div
                  key={p.id}
                  className="flex items-start justify-between gap-3 rounded-lg border p-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{p.brand_name}</p>
                      {activeProfileId === p.id && (
                        <Badge variant="default" className="text-xs">
                          <Star className="h-2.5 w-2.5 mr-1" />
                          Active
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {p.industry && <span className="mr-2">{p.industry}</span>}
                      {p.tone && <span className="mr-2">• {p.tone}</span>}
                      {p.posting_frequency && (
                        <span>• {FREQUENCY_LABELS[p.posting_frequency] ?? p.posting_frequency}</span>
                      )}
                    </p>
                    {p.keywords && (p.keywords as string[]).length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {(p.keywords as string[]).slice(0, 4).map((k) => (
                          <Badge key={k} variant="secondary" className="text-xs">
                            {k}
                          </Badge>
                        ))}
                        {(p.keywords as string[]).length > 4 && (
                          <Badge variant="secondary" className="text-xs">
                            +{(p.keywords as string[]).length - 4}
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {activeProfileId !== p.id && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs"
                        onClick={() => handleSetActive(p.id)}
                      >
                        Set Active
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEdit(p)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(p.id)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Telegram Integration */}
      <Card>
        <CardHeader>
          <CardTitle>Telegram Integration</CardTitle>
          <CardDescription>
            Link your Telegram account to capture ideas and generate content on the go.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
            <li>
              Open{" "}
              <a
                href="https://t.me/EVAContentBot"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-foreground underline underline-offset-2"
              >
                @EVAContentBot
              </a>{" "}
              on Telegram
            </li>
            <li>Copy your link token below</li>
            <li>
              Send{" "}
              <code className="bg-muted rounded px-1 py-0.5 text-xs">/start &lt;token&gt;</code>{" "}
              to the bot
            </li>
          </ol>

          {telegramToken ? (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Your Link Token</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded bg-muted px-3 py-2 text-sm font-mono break-all">
                  {telegramToken}
                </code>
                <Button variant="outline" size="icon" onClick={copyToken}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded bg-muted px-3 py-2 text-xs font-mono text-muted-foreground break-all">
                  /start {telegramToken}
                </code>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    navigator.clipboard.writeText(`/start ${telegramToken}`)
                    toast.success("Command copied!")
                  }}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Once linked, use <code className="bg-muted rounded px-1">/capture_idea &lt;text&gt;</code> or <code className="bg-muted rounded px-1">/generate_week</code>.
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic">
              Token not yet generated — sign out and back in to trigger token creation.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Profile dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Edit Brand Profile" : "Create Brand Profile"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Brand Name *</Label>
              <Input
                value={form.brand_name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, brand_name: e.target.value }))
                }
                placeholder="Acme Corp"
              />
            </div>
            <div className="space-y-2">
              <Label>Industry</Label>
              <Input
                value={form.industry}
                onChange={(e) =>
                  setForm((f) => ({ ...f, industry: e.target.value }))
                }
                placeholder="SaaS, E-commerce, Healthcare…"
              />
            </div>
            <div className="space-y-2">
              <Label>Tone</Label>
              <Select
                value={form.tone}
                onValueChange={(v) => v && setForm((f) => ({ ...f, tone: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TONES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Target Audience</Label>
              <Textarea
                value={form.audience}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    audience: e.target.value,
                  }))
                }
                placeholder="CTOs at mid-size SaaS companies…"
                rows={2}
                className="resize-none"
              />
            </div>
            <div className="space-y-2">
              <Label>Posting Frequency</Label>
              <Select
                value={form.posting_frequency}
                onValueChange={(v) =>
                  v && setForm((f) => ({ ...f, posting_frequency: v }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FREQUENCIES.map((f) => (
                    <SelectItem key={f} value={f}>
                      {FREQUENCY_LABELS[f]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Keywords</Label>
              <div className="flex gap-2">
                <Input
                  value={keywordInput}
                  onChange={(e) => setKeywordInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === ",") {
                      e.preventDefault()
                      addKeyword()
                    }
                  }}
                  placeholder="Type and press Enter"
                />
                <Button variant="outline" size="sm" onClick={addKeyword}>
                  Add
                </Button>
              </div>
              {form.keywords.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {form.keywords.map((kw) => (
                    <Badge
                      key={kw}
                      variant="secondary"
                      className="cursor-pointer"
                      onClick={() => removeKeyword(kw)}
                    >
                      {kw} ×
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editingId ? "Save Changes" : "Create Profile"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
