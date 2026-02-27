ALTER TABLE users 
  ADD COLUMN IF NOT EXISTS daily_materials_used INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS daily_materials_reset_at TIMESTAMP;
