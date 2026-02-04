-- Добавляем флаг отправки напоминания о Trial
ALTER TABLE users ADD COLUMN IF NOT EXISTS trial_reminder_sent BOOLEAN DEFAULT false;

-- Индекс для быстрого поиска пользователей для напоминаний
CREATE INDEX IF NOT EXISTS idx_users_trial_reminder 
ON users (trial_ends_at, is_trial_used, trial_reminder_sent) 
WHERE trial_ends_at IS NOT NULL AND is_trial_used = false;
