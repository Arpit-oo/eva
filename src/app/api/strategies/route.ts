import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// GET /api/strategies?brand_profile_id=xxx&limit=5
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const brandProfileId = searchParams.get("brand_profile_id")
  const limit = parseInt(searchParams.get("limit") ?? "5", 10)

  let query = supabase
    .from("Strategies")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (brandProfileId) {
    query = query.eq("brand_profile_id", brandProfileId)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ strategies: data })
}
