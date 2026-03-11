CREATE TABLE IF NOT EXISTS replicate_tasks (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    person_image TEXT NOT NULL,
    garments TEXT NOT NULL,
    prompt_hints TEXT,
    result_url TEXT,
    error_message TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP
);

CREATE INDEX idx_replicate_tasks_status ON replicate_tasks(status, created_at);
CREATE INDEX idx_replicate_tasks_user_id ON replicate_tasks(user_id);
