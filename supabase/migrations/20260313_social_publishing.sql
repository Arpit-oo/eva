ALTER TABLE public."Posts"
  ADD COLUMN IF NOT EXISTS video_url text,
  ADD COLUMN IF NOT EXISTS publish_error text,
  ADD COLUMN IF NOT EXISTS published_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_posts_status_scheduled ON public."Posts"(status, scheduled_date, scheduled_time)
  WHERE status = 'scheduled';
