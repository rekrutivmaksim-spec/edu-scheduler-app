ALTER TABLE replicate_tasks DROP CONSTRAINT IF EXISTS replicate_tasks_status_check;

ALTER TABLE replicate_tasks 
ADD CONSTRAINT replicate_tasks_status_check 
CHECK (status IN ('pending', 'processing', 'waiting_continue', 'completed', 'failed'));

ALTER TABLE replicate_tasks
ADD COLUMN intermediate_result TEXT;