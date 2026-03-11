CREATE TABLE IF NOT EXISTS nanobananapro_tasks (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    person_image TEXT NOT NULL,
    garments TEXT NOT NULL,
    prompt_hints TEXT,
    fal_request_id TEXT,
    fal_response_url TEXT,
    result_url TEXT,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_nanobananapro_tasks_status ON nanobananapro_tasks(status);
CREATE INDEX IF NOT EXISTS idx_nanobananapro_tasks_user_id ON nanobananapro_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_nanobananapro_tasks_created_at ON nanobananapro_tasks(created_at);
