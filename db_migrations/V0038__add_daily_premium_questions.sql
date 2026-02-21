ALTER TABLE users
  ADD COLUMN IF NOT EXISTS daily_premium_questions_used INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS daily_premium_questions_reset_at TIMESTAMP;
