ALTER TABLE public."SocialConnections"
  ADD COLUMN IF NOT EXISTS meta_page_id text;
