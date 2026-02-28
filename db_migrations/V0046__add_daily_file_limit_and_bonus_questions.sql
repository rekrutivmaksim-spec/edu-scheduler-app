-- Add daily file upload tracking columns to users table
ALTER TABLE t_p72971514_edu_scheduler_app.users
  ADD COLUMN IF NOT EXISTS files_uploaded_today INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS files_daily_reset_at TIMESTAMP;

-- Add question pack support: track bonus questions from packs  
-- (bonus_questions column may already exist from gamification)
-- Ensure it exists
ALTER TABLE t_p72971514_edu_scheduler_app.users
  ADD COLUMN IF NOT EXISTS bonus_questions INTEGER DEFAULT 0;
