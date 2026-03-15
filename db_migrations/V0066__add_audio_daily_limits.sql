ALTER TABLE t_p72971514_edu_scheduler_app.users
  ADD COLUMN IF NOT EXISTS audio_used_today integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS audio_daily_reset_at timestamp without time zone;