CREATE TABLE IF NOT EXISTS try_on_history (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    person_image TEXT NOT NULL,
    garment_image TEXT NOT NULL,
    result_image TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_try_on_history_user_id ON try_on_history(user_id);

CREATE TABLE IF NOT EXISTS lookbooks (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    person_name VARCHAR(255) NOT NULL,
    photos TEXT[] DEFAULT '{}',
    color_palette TEXT[] DEFAULT '{}',
    is_public BOOLEAN DEFAULT false,
    share_token VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_lookbooks_user_id ON lookbooks(user_id);
CREATE INDEX IF NOT EXISTS idx_lookbooks_share_token ON lookbooks(share_token);