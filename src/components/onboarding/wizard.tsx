"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import Image from "next/image"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Loader2, X, Zap, CheckCircle2 } from "lucide-react"
import catLogo from "../../../iconn/cat.png"

const TONES = ["Professional", "Casual", "Playful", "Inspirational", "Educational", "Bold"]
const FREQUENCIES = ["Daily", "3x per week", "5x per week", "Weekly", "Twice a week"]

const brandSchema = z.object({
  brand_name: z.string().min(1, "Brand name is required"),
  industry: z.string().min(1, "Industry is required"),
  tone: z.string().min(1, "Tone is required"),
  audience: z.string().min(10, "Describe your audience (min 10 chars)"),
  posting_frequency: z.string().min(1, "Select a posting frequency"),
})

type BrandForm = z.infer<typeof brandSchema>

export default function OnboardingWizard() {
  const router = useRouter()
  const supabase = createClient()
  const [step, setStep] = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  const [keywords, setKeywords] = useState<string[]>([])
  const [keywordInput, setKeywordInput] = useState("")

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<BrandForm>({ resolver: zodResolver(brandSchema) })

  const watchedTone = watch("tone")
  const watchedFrequency = watch("posting_frequency")

  function addKeyword(e: React.KeyboardEvent<HTMLInputElement>) {
    if ((e.key === "Enter" || e.key === ",") && keywordInput.trim()) {
      e.preventDefault()
      const kw = keywordInput.trim().replace(/^#/, "")
      if (!keywords.includes(kw)) setKeywords([...keywords, kw])
      setKeywordInput("")
    }
  }

  function removeKeyword(kw: string) {
    setKeywords(keywords.filter((k) => k !== kw))
  }

  async function onBrandSubmit(data: BrandForm) {
    setIsLoading(true)
    try {
      const res = await fetch("/api/brand-profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, keywords }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      setStep(3)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save brand profile")
    } finally {
      setIsLoading(false)
    }
  }

  async function completeOnboarding() {
    setIsLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")
      const { error } = await supabase
        .from("Users")
        .update({ onboarding_complete: true })
        .eq("id", user.id)
      if (error) throw error
      router.push("/dashboard")
      router.refresh()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Something went wrong")
      setIsLoading(false)
    }
  }

  const progress = ((step - 1) / 3) * 100

  return (
    <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-card/40 backdrop-blur-2xl shadow-[0_24px_64px_rgba(0,0,0,0.5)] p-6 md:p-8">
        {/* Progress bar */}
        <div className="mb-8">
          <div className="flex justify-between text-xs text-muted-foreground mb-2">
            <span>Step {step} of 4</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-500 rounded-full"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex justify-between mt-2">
            {["Welcome", "Brand Profile", "Connect", "Done"].map((label, i) => (
              <span
                key={label}
                className={`text-xs font-medium ${step >= i + 1 ? "text-primary" : "text-muted-foreground"}`}
              >
                {label}
              </span>
            ))}
          </div>
        </div>

        {/* Step 1: Welcome */}
        {step === 1 && (
          <div className="text-center space-y-6">
            <div className="flex justify-center">
              <div className="h-16 w-16 overflow-hidden rounded-2xl border border-white/20 bg-primary/20 shadow-[0_0_22px_rgba(76,145,255,0.35)]">
                <Image
                  src={catLogo}
                  alt="EVA cat logo"
                  width={64}
                  height={64}
                  className="h-full w-full object-cover"
                  priority
                />
              </div>
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Welcome to EVA</h1>
              <p className="mt-3 text-muted-foreground text-lg">
                Your AI-powered social media content engine. Let&apos;s set up your brand in under 2 minutes.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-3 text-left">
              {[
                ["Generate a 7-day strategy in seconds", "Tell EVA your brand — get a full week of content ideas."],
                ["Platform-perfect posts, automatically", "Captions tuned for LinkedIn, Twitter, Instagram & Facebook."],
                ["Schedule, publish & track in one place", "From idea to published post without leaving the app."],
              ].map(([title, desc]) => (
                <div key={title} className="flex gap-3 p-3 rounded-lg bg-muted/50">
                  <Zap className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium">{title}</p>
                    <p className="text-xs text-muted-foreground">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <Button size="lg" className="w-full" onClick={() => setStep(2)}>
              Get Started
            </Button>
          </div>
        )}

        {/* Step 2: Brand Profile */}
        {step === 2 && (
          <form onSubmit={handleSubmit(onBrandSubmit)} className="space-y-5">
            <div>
              <h2 className="text-2xl font-bold">Your Brand Profile</h2>
              <p className="text-muted-foreground mt-1">This is what EVA uses to generate all your content.</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-1.5">
                <Label>Brand Name *</Label>
                <Input {...register("brand_name")} placeholder="Acme Corp" />
                {errors.brand_name && <p className="text-xs text-destructive">{errors.brand_name.message}</p>}
              </div>

              <div className="space-y-1.5">
                <Label>Industry *</Label>
                <Input {...register("industry")} placeholder="SaaS / E-commerce / Fitness…" />
                {errors.industry && <p className="text-xs text-destructive">{errors.industry.message}</p>}
              </div>

              <div className="space-y-1.5">
                <Label>Posting Frequency *</Label>
                <Select onValueChange={(v) => v && setValue("posting_frequency", v)} value={watchedFrequency}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select frequency" />
                  </SelectTrigger>
                  <SelectContent>
                    {FREQUENCIES.map((f) => (
                      <SelectItem key={f} value={f}>{f}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.posting_frequency && <p className="text-xs text-destructive">{errors.posting_frequency.message}</p>}
              </div>

              <div className="col-span-2 space-y-1.5">
                <Label>Brand Tone *</Label>
                <div className="flex flex-wrap gap-2">
                  {TONES.map((tone) => (
                    <button
                      key={tone}
                      type="button"
                      onClick={() => setValue("tone", tone)}
                      className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                        watchedTone === tone
                          ? "bg-primary text-primary-foreground border-primary"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      {tone}
                    </button>
                  ))}
                </div>
                {errors.tone && <p className="text-xs text-destructive">{errors.tone.message}</p>}
              </div>

              <div className="col-span-2 space-y-1.5">
                <Label>Target Audience *</Label>
                <Textarea
                  {...register("audience")}
                  placeholder="e.g. SaaS founders aged 25-45 who want to grow their online presence..."
                  className="resize-none"
                  rows={2}
                />
                {errors.audience && <p className="text-xs text-destructive">{errors.audience.message}</p>}
              </div>

              <div className="col-span-2 space-y-1.5">
                <Label>Keywords / Topics</Label>
                <div className="flex flex-wrap gap-1.5 p-2 border rounded-md min-h-[2.5rem]">
                  {keywords.map((kw) => (
                    <Badge key={kw} variant="secondary" className="gap-1">
                      #{kw}
                      <button type="button" onClick={() => removeKeyword(kw)}>
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                  <input
                    value={keywordInput}
                    onChange={(e) => setKeywordInput(e.target.value)}
                    onKeyDown={addKeyword}
                    placeholder={keywords.length === 0 ? "Type a keyword and press Enter…" : ""}
                    className="flex-1 min-w-[120px] bg-transparent text-sm outline-none"
                  />
                </div>
              </div>

            </div>

            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setStep(1)} className="flex-1">
                Back
              </Button>
              <Button type="submit" disabled={isLoading} className="flex-1">
                {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Continue
              </Button>
            </div>
          </form>
        )}

        {/* Step 3: Connect Social Platforms (placeholders) */}
        {step === 3 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold">Connect Your Accounts</h2>
              <p className="text-muted-foreground mt-1">
                Connect your social platforms to enable direct publishing. You can skip this and connect later in Settings.
              </p>
            </div>
            <div className="space-y-3">
              {[
                { name: "LinkedIn", color: "bg-[#0077B5]", icon: "in" },
                { name: "Twitter / X", color: "bg-black", icon: "𝕏" },
              ].map(({ name, color, icon }) => (
                <div
                  key={name}
                  className="flex items-center justify-between p-4 rounded-lg border"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-lg ${color} flex items-center justify-center text-white text-sm font-bold`}>
                      {icon}
                    </div>
                    <span className="font-medium">{name}</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const platform = name === "LinkedIn" ? "linkedin" : "twitter"
                      window.location.href = `/api/social/connect/${platform}`
                    }}
                  >
                    Connect
                  </Button>
                </div>
              ))}
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep(2)} className="flex-1">
                Back
              </Button>
              <Button onClick={() => setStep(4)} className="flex-1">
                Connect Later
              </Button>
            </div>
          </div>
        )}

        {/* Step 4: Complete */}
        {step === 4 && (
          <div className="text-center space-y-6">
            <div className="flex justify-center">
              <div className="h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <CheckCircle2 className="h-9 w-9 text-green-600" />
              </div>
            </div>
            <div>
              <h2 className="text-2xl font-bold">You&apos;re all set!</h2>
              <p className="text-muted-foreground mt-2">
                Your brand profile is ready. Head to the dashboard to generate your first week of content.
              </p>
            </div>
            <Button size="lg" className="w-full" onClick={completeOnboarding} disabled={isLoading}>
              {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Go to Dashboard
            </Button>
          </div>
        )}
    </div>
  )
}
