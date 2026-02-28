-- Дневные лимиты распознавания фото
ALTER TABLE t_p72971514_edu_scheduler_app.users
  ADD COLUMN IF NOT EXISTS photos_used_today   INTEGER   DEFAULT 0,
  ADD COLUMN IF NOT EXISTS photos_daily_reset_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS bonus_photos        INTEGER   DEFAULT 0;
