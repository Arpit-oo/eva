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
import { Plus, Pencil, Trash2, Copy, Loader2, Star, Link2, Unlink2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import type { BrandProfileRow, SocialConnectionRow, SocialPlatform } from "@/lib/types"

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
  const [socialConnections, setSocialConnections] = useState<SocialConnectionRow[]>([])
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null)
  const [telegramToken, setTelegramToken] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<ProfileFormData>(empty)
  const [keywordInput, setKeywordInput] = useState("")
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [connectingPlatform, setConnectingPlatform] = useState<SocialPlatform | null>(null)
  const [disconnectingPlatform, setDisconnectingPlatform] = useState<SocialPlatform | null>(null)

  useEffect(() => {
    loadData()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const connected = params.get("social_connected")
    const socialError = params.get("social_error")
    if (connected) {
      toast.success(`${connected} account connected`)
      window.history.replaceState({}, "", window.location.pathname)
    }
    if (socialError) {
      toast.error(decodeURIComponent(socialError))
      window.history.replaceState({}, "", window.location.pathname)
    }
  }, [])

  async function loadData() {
    setLoading(true)
    const [profilesRes, userRes, socialRes] = await Promise.all([
      fetch("/api/brand-profiles"),
      supabase.from("Users").select("active_brand_profile_id, telegram_link_token").single(),
      fetch("/api/social/connections"),
    ])
    if (profilesRes.ok) {
      const data = await profilesRes.json()
      setProfiles(data.profiles ?? [])
    }
    if (!userRes.error && userRes.data) {
      setActiveProfileId(userRes.data.active_brand_profile_id)
      setTelegramToken(userRes.data.telegram_link_token)
    }
    if (socialRes.ok) {
      const data = await socialRes.json()
      setSocialConnections((data.connections ?? []) as SocialConnectionRow[])
    }
    setLoading(false)
  }

  async function connectPlatform(platform: SocialPlatform) {
    setConnectingPlatform(platform)
    window.location.href = `/api/social/connect/${platform}`
  }

  async function disconnectPlatform(platform: SocialPlatform) {
    setDisconnectingPlatform(platform)
    try {
      const res = await fetch(`/api/social/connections/${platform}`, { method: "DELETE" })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? "Disconnect failed")
      }
      setSocialConnections((prev) => prev.filter((c) => c.platform !== platform))
      toast.success(`${platform} disconnected`)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Disconnect failed")
    } finally {
      setDisconnectingPlatform(null)
    }
  }

  function getConnection(platform: SocialPlatform) {
    return socialConnections.find((c) => c.platform === platform)
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
    <div className="space-y-6">
      <div className="eva-surface px-5 py-4">
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-muted-foreground">Manage brand profiles and integrations.</p>
      </div>

      {/* Brand Profiles */}
      <Card className="eva-surface">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle id="profile">Brand Profiles</CardTitle>
            <CardDescription>
              Each profile has its own voice, tone, and content strategy.
            </CardDescription>
          </div>
          <Button size="sm" onClick={openCreate} className="rounded-xl w-full sm:w-auto">
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
                  className="flex flex-col gap-3 rounded-xl border border-white/10 bg-muted/30 p-4 sm:flex-row sm:items-start sm:justify-between"
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
                  <div className="flex items-center gap-1 shrink-0 self-end sm:self-auto">
                    {activeProfileId !== p.id && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs rounded-xl"
                        onClick={() => handleSetActive(p.id)}
                      >
                        Set Active
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEdit(p)}
                      className="rounded-xl"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(p.id)}
                      className="rounded-xl text-muted-foreground hover:text-destructive"
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

      {/* Social Integrations */}
      <Card className="eva-surface">
        <CardHeader>
          <CardTitle>Social Integrations</CardTitle>
          <CardDescription>
            Connect social accounts to publish immediately or schedule auto-publishing.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {(["linkedin", "twitter"] as SocialPlatform[]).map((platform) => {
            const connection = getConnection(platform)
            const label = platform === "twitter" ? "X (Twitter)" : platform.charAt(0).toUpperCase() + platform.slice(1)
            const description = connection
              ? `Connected as ${connection.platform_username ?? connection.platform_user_id}`
              : "Not connected"
            return (
              <div key={platform} className="flex flex-col gap-3 rounded-xl border border-white/10 bg-muted/30 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium text-sm">{label}</p>
                  <p className="text-xs text-muted-foreground">{description}</p>
                </div>
                {connection ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => disconnectPlatform(platform)}
                    disabled={disconnectingPlatform === platform}
                    className="gap-1.5 rounded-xl w-full sm:w-auto"
                  >
                    {disconnectingPlatform === platform ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Unlink2 className="h-3.5 w-3.5" />
                    )}
                    Disconnect
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => connectPlatform(platform)}
                    disabled={!!connectingPlatform}
                    className="gap-1.5 rounded-xl w-full sm:w-auto"
                  >
                    {connectingPlatform === platform ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Link2 className="h-3.5 w-3.5" />
                    )}
                    Connect
                  </Button>
                )}
              </div>
            )
          })}
        </CardContent>
      </Card>

      {/* Telegram Integration */}
      <Card className="eva-surface">
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
                href="https://t.me/project_evabell_bot"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-foreground underline underline-offset-2"
              >
                @project_evabell_bot
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
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <code className="flex-1 rounded-xl bg-muted px-3 py-2 text-sm font-mono break-all">
                  {telegramToken}
                </code>
                <Button variant="outline" size="icon" onClick={copyToken} className="rounded-xl self-end sm:self-auto">
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <code className="flex-1 rounded-xl bg-muted px-3 py-2 text-xs font-mono text-muted-foreground break-all">
                  /start {telegramToken}
                </code>
                <Button
                  variant="outline"
                  size="icon"
                  className="rounded-xl self-end sm:self-auto"
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
                className="eva-input"
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
                className="eva-input"
              />
            </div>
            <div className="space-y-2">
              <Label>Tone</Label>
              <Select
                value={form.tone}
                onValueChange={(v) => v && setForm((f) => ({ ...f, tone: v }))}
              >
                <SelectTrigger className="rounded-xl bg-muted/60 border-white/10">
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
                className="resize-none eva-input"
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
                <SelectTrigger className="rounded-xl bg-muted/60 border-white/10">
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
                  className="eva-input"
                />
                <Button variant="outline" size="sm" onClick={addKeyword} className="rounded-xl">
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
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="rounded-xl">
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving} className="rounded-xl">
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editingId ? "Save Changes" : "Create Profile"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
