-- Mark old processing tasks as failed (older than 1 hour)
UPDATE nanobananapro_tasks 
SET status = 'failed', 
    error_message = 'Task expired - stuck in processing for over 1 hour',
    updated_at = NOW()
WHERE status = 'processing' 
  AND created_at < NOW() - INTERVAL '1 hour';