import { createBrowserClient } from "@supabase/ssr"

// Provide fallback placeholder values so Next.js static analysis
// never errors during prerender of "use client" pages.
// Real values are required at runtime via .env.local
const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co"
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "placeholder-anon-key"

export function createClient() {
  return createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY)
}
