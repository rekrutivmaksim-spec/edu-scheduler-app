
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE lookbooks ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id);
ALTER TABLE lookbooks ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT FALSE;
ALTER TABLE lookbooks ADD COLUMN IF NOT EXISTS share_token VARCHAR(64) UNIQUE;

ALTER TABLE try_on_history ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id);

CREATE INDEX IF NOT EXISTS idx_lookbooks_user_id ON lookbooks(user_id);
CREATE INDEX IF NOT EXISTS idx_lookbooks_share_token ON lookbooks(share_token);
CREATE INDEX IF NOT EXISTS idx_try_on_history_user_id ON try_on_history(user_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
