-- Mark all colortype tasks as failed (wrong model configuration)
UPDATE color_type_history 
SET status = 'failed', 
    result_text = 'Задача отменена: неверная конфигурация модели (исправлено)',
    updated_at = NOW()
WHERE status IN ('pending', 'processing');