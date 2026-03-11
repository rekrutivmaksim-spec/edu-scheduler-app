ALTER TABLE replicate_tasks 
ADD COLUMN prediction_id TEXT,
ADD COLUMN current_step INTEGER DEFAULT 0,
ADD COLUMN total_steps INTEGER DEFAULT 0;