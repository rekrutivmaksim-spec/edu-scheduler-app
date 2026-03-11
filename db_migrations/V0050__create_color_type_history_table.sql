CREATE TABLE IF NOT EXISTS color_type_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    person_image TEXT,
    eye_color TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    result_text TEXT,
    color_type VARCHAR(100),
    cdn_url TEXT,
    replicate_prediction_id TEXT,
    saved_to_history BOOLEAN DEFAULT FALSE,
    refunded BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_color_type_history_user_id ON color_type_history(user_id);
CREATE INDEX IF NOT EXISTS idx_color_type_history_status ON color_type_history(status);
CREATE INDEX IF NOT EXISTS idx_color_type_history_created_at ON color_type_history(created_at DESC);