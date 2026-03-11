-- Mark stuck task as failed
UPDATE color_type_history 
SET status = 'failed', 
    result_text = 'Задача отменена вручную (ошибка промпта)', 
    updated_at = NOW() 
WHERE id = 'fdbef670-05fb-4dbd-b3c9-9cee32d01c2a' 
  AND status = 'processing';