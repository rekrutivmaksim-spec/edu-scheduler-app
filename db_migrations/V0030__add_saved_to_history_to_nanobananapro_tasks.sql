-- Add saved_to_history flag to nanobananapro_tasks table
ALTER TABLE nanobananapro_tasks ADD COLUMN IF NOT EXISTS saved_to_history BOOLEAN DEFAULT FALSE;

-- Update existing completed tasks to true (already saved)
UPDATE nanobananapro_tasks SET saved_to_history = TRUE WHERE status = 'completed';
