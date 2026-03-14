"use client"

export const dynamic = "force-dynamic"

import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2 } from "lucide-react"

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
})

type LoginForm = z.infer<typeof loginSchema>

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    const callbackError = searchParams.get("error")
    const needsEmailCheck = searchParams.get("check_email") === "1"
    const email = searchParams.get("email")
    if (callbackError === "auth_callback_failed") toast.error("Authentication failed. Please try again.")
    if (needsEmailCheck) toast.info(email ? `Check your inbox at ${email} to verify your account.` : "Check your inbox to verify your account.")
  }, [searchParams])

  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  })

  async function onSubmit(data: LoginForm) {
    setIsLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email: data.email, password: data.password })
    if (error) { toast.error(error.message); setIsLoading(false); return }
    router.push("/dashboard")
    router.refresh()
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-card/40 backdrop-blur-2xl shadow-[0_24px_64px_rgba(0,0,0,0.5)] p-8">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-foreground">Please sign in</h2>
        <p className="text-sm text-muted-foreground mt-1">Sign in to your EVA account</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email" className="text-xs uppercase tracking-widest text-muted-foreground">
            Email
          </Label>
          <Input
            id="email"
            type="email"
            placeholder="you@example.com"
            className="h-11 rounded-xl border-white/10 bg-white/5 placeholder:text-muted-foreground/50 focus-visible:ring-primary/60 focus-visible:border-primary/40"
            {...register("email")}
          />
          {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password" className="text-xs uppercase tracking-widest text-muted-foreground">
            Password
          </Label>
          <Input
            id="password"
            type="password"
            placeholder="••••••••"
            className="h-11 rounded-xl border-white/10 bg-white/5 placeholder:text-muted-foreground/50 focus-visible:ring-primary/60 focus-visible:border-primary/40"
            {...register("password")}
          />
          {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full h-11 mt-2 rounded-xl bg-primary/90 hover:bg-primary text-primary-foreground text-sm font-semibold shadow-[0_0_24px_rgba(76,145,255,0.45)] hover:shadow-[0_0_32px_rgba(76,145,255,0.6)] transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
          Sign In
        </button>
      </form>

      <p className="text-center text-sm text-muted-foreground mt-6">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="text-primary hover:text-primary/80 font-medium transition-colors">
          Sign up
        </Link>
      </p>
    </div>
  )
}
