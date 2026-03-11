-- Create debug log table for tracking history API requests
CREATE TABLE IF NOT EXISTS history_api_debug_log (
    id SERIAL PRIMARY KEY,
    request_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    user_id TEXT,
    model_used TEXT,
    result_image_preview TEXT,
    raw_body TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);