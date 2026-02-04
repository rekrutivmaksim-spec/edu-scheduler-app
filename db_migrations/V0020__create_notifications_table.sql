-- Создаём таблицу для уведомлений внутри приложения
CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    action_url VARCHAR(500),
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    read_at TIMESTAMP
);

-- Индекс для быстрого получения непрочитанных уведомлений пользователя
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread 
ON notifications (user_id, is_read, created_at DESC);

-- Индекс для быстрой очистки старых уведомлений
CREATE INDEX IF NOT EXISTS idx_notifications_created 
ON notifications (created_at);
