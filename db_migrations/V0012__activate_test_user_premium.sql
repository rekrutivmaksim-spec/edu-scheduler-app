-- Активация premium подписки для тестового пользователя
UPDATE users 
SET subscription_type = 'premium',
    subscription_expires_at = CURRENT_TIMESTAMP + INTERVAL '30 days'
WHERE id = 1;