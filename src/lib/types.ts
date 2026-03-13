// Database Types for Project EVA
// Auto-aligned with supabase/schema.sql

export type UserRow = {
  id: string
  name: string
  email: string
  telegram_chat_id: string | null
  telegram_link_token: string
  active_brand_profile_id: string | null
  onboarding_complete: boolean
  created_at: string
}

export type BrandProfileRow = {
  id: string
  user_id: string
  brand_name: string
  industry: string
  tone: string
  audience: string
  keywords: string[]
  platforms: string[]
  posting_frequency: string
  created_at: string
}

export type StrategyDay = {
  day_of_week: string
  content_type: string
  theme: string
  target_emotion: string
}

export type StrategyJson = {
  week_theme: string
  days: StrategyDay[]
}

export type StrategyRow = {
  id: string
  user_id: string
  brand_profile_id: string
  week_start: string
  strategy_json: StrategyJson
  created_at: string
}

export type PostStatus = "draft" | "scheduled" | "published" | "failed"
export type SocialPlatform = "linkedin" | "twitter" | "instagram" | "facebook"
export type InstagramContentType = "Feed" | "Story" | "Reel"

export type PostRow = {
  id: string
  user_id: string
  platform: SocialPlatform
  caption: string
  hashtags: string[]
  image_prompt: string | null
  image_url: string | null
  video_url: string | null
  platform_post_id: string | null
  publish_error: string | null
  published_at: string | null
  scheduled_date: string | null
  scheduled_time: string | null
  status: PostStatus
  created_at: string
}

export type TemplateRow = {
  id: string
  user_id: string
  template_name: string
  caption: string
  hashtags: string[]
  image_prompt: string | null
  created_at: string
}

export type IdeaRow = {
  id: string
  user_id: string
  idea_text: string
  created_at: string
}

export type SocialConnectionRow = {
  id: string
  user_id: string
  platform: SocialPlatform
  platform_user_id: string
  meta_page_id: string | null
  platform_username: string | null
  access_token: string
  refresh_token: string | null
  token_expires_at: string | null
  status: "active" | "expired"
  created_at: string
}

export type PostAnalyticsRow = {
  id: string
  post_id: string
  user_id: string
  likes: number
  shares: number
  comments: number
  impressions: number
  fetched_at: string
}

export type GenerationJobStatus = "pending" | "running" | "completed" | "failed"

export type GenerationJobRow = {
  id: string
  user_id: string
  strategy_id: string | null
  status: GenerationJobStatus
  total_items: number
  completed_items: number
  failed_items: number
  error_details: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

// AI Pipeline types

export type EvaluationResult = {
  score: number
  strengths: string[]
  suggestions: string[]
  improved_caption: string
}

export type GeneratedPost = {
  platform: string
  caption: string
  hashtags: string[]
  image_prompt: string
  best_posting_time: string
}

// Platform character limits
export const PLATFORM_CHAR_LIMITS: Record<SocialPlatform, number> = {
  twitter: 280,
  linkedin: 3000,
  instagram: 2200,
  facebook: 63206,
}

export const PLATFORM_LABELS: Record<SocialPlatform, string> = {
  linkedin: "LinkedIn",
  twitter: "Twitter/X",
  instagram: "Instagram",
  facebook: "Facebook",
}
