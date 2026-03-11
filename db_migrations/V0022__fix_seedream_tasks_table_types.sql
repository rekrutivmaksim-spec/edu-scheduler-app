-- Fix seedream_tasks table to use TEXT instead of VARCHAR/JSONB
ALTER TABLE seedream_tasks 
  ALTER COLUMN id TYPE TEXT,
  ALTER COLUMN user_id TYPE TEXT,
  ALTER COLUMN status TYPE TEXT,
  ALTER COLUMN garments TYPE TEXT;

-- Remove old constraint and add new one
ALTER TABLE seedream_tasks DROP CONSTRAINT IF EXISTS seedream_tasks_status_check;
ALTER TABLE seedream_tasks ADD CONSTRAINT seedream_tasks_status_check 
  CHECK (status IN ('pending', 'processing', 'completed', 'failed'));

-- Update default for created_at
ALTER TABLE seedream_tasks ALTER COLUMN created_at SET DEFAULT NOW();
