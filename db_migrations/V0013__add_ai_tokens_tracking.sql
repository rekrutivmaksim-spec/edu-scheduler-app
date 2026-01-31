-- Добавляем поля для подсчёта токенов ИИ-ассистента
ALTER TABLE t_p72971514_edu_scheduler_app.users 
ADD COLUMN IF NOT EXISTS ai_tokens_used INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS ai_tokens_reset_at TIMESTAMP DEFAULT (CURRENT_TIMESTAMP + INTERVAL '1 month');

-- Переносим данные из старых полей (если были запросы)
UPDATE t_p72971514_edu_scheduler_app.users 
SET ai_tokens_used = COALESCE(ai_requests_used, 0) * 500
WHERE ai_requests_used > 0;

-- Обновляем дату сброса
UPDATE t_p72971514_edu_scheduler_app.users
SET ai_tokens_reset_at = COALESCE(ai_requests_reset_at, CURRENT_TIMESTAMP + INTERVAL '1 month')
WHERE ai_requests_reset_at IS NOT NULL;