-- Mark stuck colortype task as failed
UPDATE color_type_history 
SET status = 'failed', 
    result_text = 'Задача была застрявшей и отменена вручную',
    updated_at = NOW()
WHERE id = '46a68d23-107a-4b20-b414-db1a86c68b12' AND status = 'processing';
