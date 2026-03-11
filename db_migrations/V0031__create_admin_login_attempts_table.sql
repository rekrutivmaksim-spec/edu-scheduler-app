-- Create table for admin login attempts tracking
CREATE TABLE IF NOT EXISTS admin_login_attempts (
    id SERIAL PRIMARY KEY,
    ip_address VARCHAR(45) NOT NULL,
    success BOOLEAN NOT NULL DEFAULT false,
    attempt_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Add index for efficient queries
CREATE INDEX IF NOT EXISTS idx_admin_login_attempts_ip_time 
ON admin_login_attempts(ip_address, attempt_time DESC);

-- Add index for cleanup queries
CREATE INDEX IF NOT EXISTS idx_admin_login_attempts_time 
ON admin_login_attempts(attempt_time DESC);
