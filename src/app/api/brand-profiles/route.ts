import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data, error } = await supabase
    .from("BrandProfiles")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ profiles: data })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json()
  const { brand_name, industry, tone, audience, keywords, platforms, posting_frequency } = body

  if (!brand_name || !industry || !tone || !audience || !posting_frequency) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
  }

  const { data, error } = await supabase
    .from("BrandProfiles")
    .insert({
      user_id: user.id,
      brand_name,
      industry,
      tone,
      audience,
      keywords: keywords ?? [],
      platforms: platforms ?? [],
      posting_frequency,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Set as active profile
  await supabase
    .from("Users")
    .update({ active_brand_profile_id: data.id })
    .eq("id", user.id)

  return NextResponse.json({ profile: data }, { status: 201 })
}
