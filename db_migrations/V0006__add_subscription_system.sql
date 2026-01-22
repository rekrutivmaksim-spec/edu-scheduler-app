-- Добавляем поля для системы подписок в таблицу users
ALTER TABLE users ADD COLUMN subscription_type VARCHAR(20) DEFAULT 'free';
ALTER TABLE users ADD COLUMN subscription_expires_at TIMESTAMP;
ALTER TABLE users ADD COLUMN materials_quota_used INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN materials_quota_reset_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP + INTERVAL '1 month';

-- Создаём индексы для оптимизации
CREATE INDEX idx_users_subscription_type ON users(subscription_type);
CREATE INDEX idx_users_subscription_expires ON users(subscription_expires_at);

-- Комментарии для понимания
COMMENT ON COLUMN users.subscription_type IS 'Тип подписки: free, premium';
COMMENT ON COLUMN users.subscription_expires_at IS 'Дата окончания премиум подписки';
COMMENT ON COLUMN users.materials_quota_used IS 'Использовано фото в текущем месяце (лимит 3 для free)';
COMMENT ON COLUMN users.materials_quota_reset_at IS 'Дата сброса квоты материалов';