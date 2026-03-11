UPDATE replicate_tasks
SET status = 'pending',
    prediction_id = NULL,
    current_step = 0,
    error_message = NULL,
    updated_at = NOW()
WHERE status = 'processing' 
  AND updated_at < NOW() - INTERVAL '5 minutes';