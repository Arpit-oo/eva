/**
 * Run DB migration using Supabase Management API
 * The management API accepts service role keys for project-scoped operations
 */
import { config } from "dotenv"

config({ path: ".env.local" })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing env vars")
  process.exit(1)
}

const projectRef = new URL(SUPABASE_URL).hostname.split(".")[0]
console.log(`Project ref: ${projectRef}`)

const sql = `ALTER TABLE public."Posts"
  ADD COLUMN IF NOT EXISTS video_url text,
  ADD COLUMN IF NOT EXISTS publish_error text,
  ADD COLUMN IF NOT EXISTS published_at timestamptz;`

const indexSql = `CREATE INDEX IF NOT EXISTS idx_posts_status_scheduled ON public."Posts"(status, scheduled_date, scheduled_time) WHERE status = 'scheduled';`

// Try Supabase's direct DB REST endpoint (pg-meta API)
// This is the API that supabase dashboard uses internally
const endpoints = [
  `${SUPABASE_URL}/rest/v1/rpc/exec_sql`,
  `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
  `${SUPABASE_URL.replace('.supabase.co', '.supabase.co')}/pg/query`,
]

// Method: Use Supabase's pg-meta API which is exposed per-project
const pgMetaUrl = `https://${projectRef}.supabase.co/pg/query`

const tryFetch = async (url, body, headers) => {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
    })
    const text = await res.text()
    return { ok: res.ok, status: res.status, body: text }
  } catch (e) {
    return { ok: false, error: e.message }
  }
}

// Try pg-meta endpoint
console.log("Trying pg-meta endpoint...")
const r1 = await tryFetch(
  `${SUPABASE_URL}/pg/query`,
  { query: sql },
  { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` }
)
console.log("pg-meta result:", r1.status, r1.body?.slice(0, 200))

if (!r1.ok) {
  // Try direct management API
  console.log("\nTrying management API (/v1/projects/X/database/query)...")
  const r2 = await tryFetch(
    `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
    { query: sql },
    { Authorization: `Bearer ${SERVICE_ROLE_KEY}` }
  )
  console.log("Mgmt API result:", r2.status, r2.body?.slice(0, 300))
  
  if (!r2.ok) {
    console.log("\n❌ Automated migration not possible without:")
    console.log("   1. A Supabase Personal Access Token (SUPABASE_ACCESS_TOKEN), OR")
    console.log("   2. A direct Postgres connection string (DATABASE_URL)")
    console.log("")
    console.log("Please run these two statements in Supabase SQL Editor:")
    console.log("→ https://supabase.com/dashboard/project/" + projectRef + "/sql/new")
    console.log("")
    console.log("SQL to run:")
    console.log("---")
    console.log(sql)
    console.log("")
    console.log(indexSql)
    console.log("---")
  }
}
