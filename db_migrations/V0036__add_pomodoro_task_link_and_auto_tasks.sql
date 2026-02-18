
ALTER TABLE pomodoro_sessions ADD COLUMN IF NOT EXISTS task_id INTEGER;

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS auto_generated BOOLEAN DEFAULT false;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS source_type VARCHAR(20) DEFAULT NULL;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS source_id INTEGER DEFAULT NULL;

CREATE TABLE IF NOT EXISTS smart_suggestions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    suggestion_type VARCHAR(30) NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    action_type VARCHAR(30),
    action_data JSONB,
    priority INTEGER DEFAULT 0,
    is_dismissed BOOLEAN DEFAULT false,
    is_acted BOOLEAN DEFAULT false,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_smart_suggestions_user ON smart_suggestions(user_id, is_dismissed, expires_at);
CREATE INDEX IF NOT EXISTS idx_pomodoro_task ON pomodoro_sessions(task_id);
