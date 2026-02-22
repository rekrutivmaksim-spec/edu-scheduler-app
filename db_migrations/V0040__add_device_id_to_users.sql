ALTER TABLE users ADD COLUMN IF NOT EXISTS device_id VARCHAR(255);
CREATE INDEX IF NOT EXISTS idx_users_device_id ON users(device_id);