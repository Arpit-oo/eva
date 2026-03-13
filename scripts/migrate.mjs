/**
 * Run DB migration via Supabase Management REST API
 * Usage: SUPABASE_ACCESS_TOKEN=<personal-access-token> node scripts/migrate.mjs
 * OR just: node scripts/migrate.mjs  (reads .env.local for the DB URL via pg)
 */
import { createClient } from "@supabase/supabase-js"
import { readFileSync } from "fs"
import { config } from "dotenv"

config({ path: ".env.local" })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local")
  process.exit(1)
}

// Try: call supabase with service role via direct SQL execution
// Supabase exposes a SQL execution endpoint at POST /rest/v1/ using service role for DDL
// The trick is to use the pg Meta endpoint (Supabase-specific)
const projectRef = new URL(SUPABASE_URL).hostname.split(".")[0]
console.log(`Project: ${projectRef}`)

const sql = `
ALTER TABLE public."Posts"
  ADD COLUMN IF NOT EXISTS video_url text,
  ADD COLUMN IF NOT EXISTS publish_error text,
  ADD COLUMN IF NOT EXISTS published_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_posts_status_scheduled ON public."Posts"(status, scheduled_date, scheduled_time)
  WHERE status = 'scheduled';
`

// Method 1: Use supabase-js with direct SQL via rpc
// First, check if columns already exist
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

console.log("Checking if columns already exist...")
const { data: checkData, error: checkError } = await supabase
  .from("Posts")
  .select("publish_error, published_at, video_url")
  .limit(1)

if (checkData !== null && !checkError) {
  console.log("✅ Columns already exist! Migration already applied.")
  process.exit(0)
}

if (checkError?.code === "42703") {
  console.log("Columns missing. Running migration...")
  
  // Supabase doesn't support raw DDL via supabase-js.
  // Use the management API if we have an access token.
  const accessToken = process.env.SUPABASE_ACCESS_TOKEN?.trim()
  
  if (accessToken) {
    const mgmtRes = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ query: sql }),
    })
    
    if (mgmtRes.ok) {
      console.log("✅ Migration applied via Management API")
      process.exit(0)
    }
    
    const errText = await mgmtRes.text()
    console.error("Management API error:", errText)
  }
  
  // Fallback: print the SQL to run manually
  console.log("")
  console.log("⚠️  Could not apply migration automatically.")
  console.log("Please run this SQL in Supabase Dashboard > SQL Editor:")
  console.log("=".repeat(60))
  console.log(sql.trim())
  console.log("=".repeat(60))
  console.log("")
  console.log("URL: https://supabase.com/dashboard/project/gzkgssymtexqrkarwbmd/sql")
  process.exit(1)
}

console.error("Unexpected error checking columns:", checkError)
process.exit(1)
