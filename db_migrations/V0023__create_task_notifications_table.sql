-- Создание таблицы для уведомлений о дедлайнах задач
CREATE TABLE IF NOT EXISTS task_notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    notification_type VARCHAR(20) NOT NULL CHECK (notification_type IN ('1hour', '1day', '3days')),
    notification_time TIMESTAMP NOT NULL,
    is_sent BOOLEAN NOT NULL DEFAULT FALSE,
    sent_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_task_notifications_user_id ON task_notifications(user_id);
CREATE INDEX idx_task_notifications_task_id ON task_notifications(task_id);
CREATE INDEX idx_task_notifications_time ON task_notifications(notification_time, is_sent);

-- Добавляем колонку для email уведомлений в таблицу users (если её нет)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='users' AND column_name='email_notifications_enabled') THEN
        ALTER TABLE users ADD COLUMN email_notifications_enabled BOOLEAN DEFAULT TRUE;
    END IF;
END $$;
