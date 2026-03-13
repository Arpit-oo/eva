// Run the social publishing migration against Supabase
// Usage: node scripts/run-migration.mjs

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
  process.exit(1)
}

const sql = `
ALTER TABLE public."Posts"
  ADD COLUMN IF NOT EXISTS video_url text,
  ADD COLUMN IF NOT EXISTS publish_error text,
  ADD COLUMN IF NOT EXISTS published_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_posts_status_scheduled ON public."Posts"(status, scheduled_date, scheduled_time)
  WHERE status = 'scheduled';
`

const url = `${SUPABASE_URL.trim().replace(/\/$/, "")}/rest/v1/rpc/query`

// Use the Supabase SQL endpoint directly via the postgres REST endpoint
// We'll use the /rest/v1/ with a raw SQL call via the pg endpoint
const pgUrl = `${SUPABASE_URL.trim().replace(/\/$/, "")}/pg`

// Actually use the management API approach: POST to /query endpoint
const queryUrl = `${SUPABASE_URL.trim().replace(/\/$/, "")}/rest/v1/rpc/exec_sql`

// The correct way is to use the Postgres REST endpoint
// Supabase exposes SQL execution via the service role on /rest/v1/
// But the cleanest way is via the pg REST endpoint
// Let's use the supabase-js client approach via a fetch

// Supabase allows raw SQL via the DB URL or via pg-gateway
// The simplest: use their REST API with service role and execute via a stored function
// OR: use the supabase CLI

// Best approach: use the supabase-js query builder doesn't support raw DDL
// Use the Postgres REST API that Supabase exposes
const response = await fetch(`${SUPABASE_URL.trim().replace(/\/$/, "")}/rest/v1/rpc/exec_sql`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    apikey: SERVICE_ROLE_KEY.trim(),
    Authorization: `Bearer ${SERVICE_ROLE_KEY.trim()}`,
  },
  body: JSON.stringify({ sql }),
})

if (response.ok) {
  console.log("Migration ran successfully via exec_sql RPC")
  process.exit(0)
}

// That function may not exist. Try the query endpoint
const res2 = await fetch(`${SUPABASE_URL.trim().replace(/\/$/, "")}/pg/query`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    apikey: SERVICE_ROLE_KEY.trim(),
    Authorization: `Bearer ${SERVICE_ROLE_KEY.trim()}`,
  },
  body: JSON.stringify({ query: sql }),
})

if (res2.ok) {
  console.log("Migration ran successfully via /pg/query")
  process.exit(0)
}

// Try the management API SQL endpoint
const projectRef = new URL(SUPABASE_URL.trim()).hostname.split(".")[0]
console.log(`Project ref: ${projectRef}`)
console.log("NOTE: Direct SQL DDL via REST isn't supported without the management API.")
console.log("Please run this SQL in Supabase Dashboard > SQL Editor:")
console.log("---")
console.log(sql)
console.log("---")
process.exit(1)
