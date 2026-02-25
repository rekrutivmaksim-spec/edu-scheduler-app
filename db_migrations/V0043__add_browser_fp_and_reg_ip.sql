ALTER TABLE users ADD COLUMN IF NOT EXISTS browser_fp VARCHAR(64);
ALTER TABLE users ADD COLUMN IF NOT EXISTS reg_ip VARCHAR(45);
CREATE INDEX IF NOT EXISTS idx_users_browser_fp ON users(browser_fp) WHERE browser_fp IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_reg_ip ON users(reg_ip) WHERE reg_ip IS NOT NULL;