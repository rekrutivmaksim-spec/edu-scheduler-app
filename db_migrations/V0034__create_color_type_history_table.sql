-- Create color_type_history table for storing color type analysis results
CREATE TABLE IF NOT EXISTS color_type_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    person_image TEXT NOT NULL,
    result_text TEXT,
    color_type TEXT,
    replicate_prediction_id TEXT,
    saved_to_history BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create index for faster user queries
CREATE INDEX IF NOT EXISTS idx_color_type_history_user_id ON color_type_history(user_id);

-- Create index for status queries
CREATE INDEX IF NOT EXISTS idx_color_type_history_status ON color_type_history(status);

-- Create index for finding pending/processing tasks
CREATE INDEX IF NOT EXISTS idx_color_type_history_user_status ON color_type_history(user_id, status);