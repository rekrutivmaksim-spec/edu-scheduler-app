-- Create table for SeeDream 4 async tasks
CREATE TABLE IF NOT EXISTS seedream_tasks (
    id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    person_image TEXT NOT NULL,
    garments JSONB NOT NULL,
    custom_prompt TEXT,
    result_url TEXT,
    error_message TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_seedream_tasks_status ON seedream_tasks(status);
CREATE INDEX IF NOT EXISTS idx_seedream_tasks_user_id ON seedream_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_seedream_tasks_created_at ON seedream_tasks(created_at);
