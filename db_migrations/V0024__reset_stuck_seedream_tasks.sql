UPDATE seedream_tasks 
SET status = 'pending', fal_request_id = NULL 
WHERE status = 'processing' AND result_url IS NULL;