-- Добавляем новые поля для отслеживания вопросов и плана подписки
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS ai_questions_used INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS ai_questions_limit INTEGER DEFAULT 40,
ADD COLUMN IF NOT EXISTS ai_questions_reset_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS subscription_plan VARCHAR(20) DEFAULT '1month';

-- Обновляем существующих премиум пользователей
UPDATE users 
SET ai_questions_limit = 40, 
    subscription_plan = '1month'
WHERE subscription_type = 'premium' AND ai_questions_limit IS NULL;