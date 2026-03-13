-- ============================================================
-- Project EVA - Database Schema
-- Run this in your Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. Users (extends auth.users)
-- ============================================================
CREATE TABLE IF NOT EXISTS public."Users" (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  telegram_chat_id text UNIQUE,
  telegram_link_token uuid NOT NULL DEFAULT uuid_generate_v4(),
  active_brand_profile_id uuid,
  onboarding_complete boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public."Users" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can only access their own data" ON public."Users"
  FOR ALL USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Auto-create User record on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public."Users" (id, name, email)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- 2. BrandProfiles
-- ============================================================
CREATE TABLE IF NOT EXISTS public."BrandProfiles" (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES public."Users"(id) ON DELETE CASCADE,
  brand_name text NOT NULL,
  industry text NOT NULL,
  tone text NOT NULL,
  audience text NOT NULL,
  keywords text[] NOT NULL DEFAULT '{}',
  platforms text[] NOT NULL DEFAULT '{}',
  posting_frequency text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public."BrandProfiles" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can only access their own data" ON public."BrandProfiles"
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Add FK from Users.active_brand_profile_id after BrandProfiles is created
ALTER TABLE public."Users"
  ADD CONSTRAINT fk_active_brand_profile
  FOREIGN KEY (active_brand_profile_id)
  REFERENCES public."BrandProfiles"(id)
  ON DELETE SET NULL;

-- ============================================================
-- 3. Strategies
-- ============================================================
CREATE TABLE IF NOT EXISTS public."Strategies" (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES public."Users"(id) ON DELETE CASCADE,
  brand_profile_id uuid NOT NULL REFERENCES public."BrandProfiles"(id) ON DELETE CASCADE,
  week_start date NOT NULL,
  strategy_json jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public."Strategies" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can only access their own data" ON public."Strategies"
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- 4. Posts
-- ============================================================
CREATE TABLE IF NOT EXISTS public."Posts" (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES public."Users"(id) ON DELETE CASCADE,
  platform text NOT NULL,
  caption text NOT NULL,
  hashtags text[] NOT NULL DEFAULT '{}',
  image_prompt text,
  image_url text,
  video_url text,
  platform_post_id text,
  publish_error text,
  published_at timestamptz,
  scheduled_date date,
  scheduled_time time,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'published', 'failed')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public."Posts" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can only access their own data" ON public."Posts"
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Index for cron job querying scheduled posts
CREATE INDEX IF NOT EXISTS idx_posts_status_scheduled ON public."Posts"(status, scheduled_date, scheduled_time)
  WHERE status = 'scheduled';

-- ============================================================
-- 5. Templates
-- ============================================================
CREATE TABLE IF NOT EXISTS public."Templates" (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES public."Users"(id) ON DELETE CASCADE,
  template_name text NOT NULL,
  caption text NOT NULL,
  hashtags text[] NOT NULL DEFAULT '{}',
  image_prompt text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public."Templates" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can only access their own data" ON public."Templates"
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- 6. Ideas
-- ============================================================
CREATE TABLE IF NOT EXISTS public."Ideas" (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES public."Users"(id) ON DELETE CASCADE,
  idea_text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public."Ideas" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can only access their own data" ON public."Ideas"
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- 7. SocialConnections
-- ============================================================
CREATE TABLE IF NOT EXISTS public."SocialConnections" (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES public."Users"(id) ON DELETE CASCADE,
  platform text NOT NULL CHECK (platform IN ('linkedin', 'twitter', 'instagram', 'facebook')),
  platform_user_id text NOT NULL,
  platform_username text,
  access_token text NOT NULL,
  refresh_token text,
  token_expires_at timestamptz,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, platform)
);

ALTER TABLE public."SocialConnections" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can only access their own data" ON public."SocialConnections"
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- 8. PostAnalytics
-- ============================================================
CREATE TABLE IF NOT EXISTS public."PostAnalytics" (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id uuid NOT NULL REFERENCES public."Posts"(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public."Users"(id) ON DELETE CASCADE,
  likes integer NOT NULL DEFAULT 0,
  shares integer NOT NULL DEFAULT 0,
  comments integer NOT NULL DEFAULT 0,
  impressions integer NOT NULL DEFAULT 0,
  fetched_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public."PostAnalytics" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can only access their own data" ON public."PostAnalytics"
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- 9. GenerationJobs (for polling post-generation progress)
-- ============================================================
CREATE TABLE IF NOT EXISTS public."GenerationJobs" (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES public."Users"(id) ON DELETE CASCADE,
  strategy_id uuid REFERENCES public."Strategies"(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  total_items integer NOT NULL DEFAULT 0,
  completed_items integer NOT NULL DEFAULT 0,
  failed_items integer NOT NULL DEFAULT 0,
  error_details jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public."GenerationJobs" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can only access their own data" ON public."GenerationJobs"
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- Supabase Storage: post-images bucket
-- Run in Supabase Dashboard > Storage > New Bucket or via API:
--   Name: post-images
--   Public: true
-- ============================================================
