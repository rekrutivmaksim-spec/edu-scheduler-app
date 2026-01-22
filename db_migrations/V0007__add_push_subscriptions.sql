-- Таблица для хранения push-подписок пользователей
CREATE TABLE IF NOT EXISTS push_subscriptions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, endpoint)
);

CREATE INDEX idx_push_subscriptions_user_id ON push_subscriptions(user_id);
CREATE INDEX idx_push_subscriptions_created_at ON push_subscriptions(created_at);

-- Таблица для хранения настроек уведомлений
CREATE TABLE IF NOT EXISTS notification_settings (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    lessons_reminder BOOLEAN DEFAULT TRUE,
    tasks_reminder BOOLEAN DEFAULT TRUE,
    deadline_reminder BOOLEAN DEFAULT TRUE,
    reminder_time TIME DEFAULT '08:00:00',
    UNIQUE(user_id)
);

CREATE INDEX idx_notification_settings_user_id ON notification_settings(user_id);
