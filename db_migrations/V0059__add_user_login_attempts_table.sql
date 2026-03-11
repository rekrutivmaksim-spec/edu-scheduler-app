-- Create user_login_attempts table for rate limiting
CREATE TABLE IF NOT EXISTS user_login_attempts (
    id SERIAL PRIMARY KEY,
    ip_address VARCHAR(45) NOT NULL,
    email VARCHAR(255),
    success BOOLEAN NOT NULL DEFAULT false,
    attempt_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_user_login_attempts_ip_time ON user_login_attempts(ip_address, attempt_time);
CREATE INDEX IF NOT EXISTS idx_user_login_attempts_email_time ON user_login_attempts(email, attempt_time);