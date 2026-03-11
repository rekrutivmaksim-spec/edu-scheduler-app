-- Mark stuck processing tasks as failed
UPDATE color_type_history 
SET status = 'failed', 
    result_text = 'Задача отменена вручную (некорректная версия модели)',
    updated_at = NOW()
WHERE id IN ('2f2aeef5-745b-4b68-8597-44f8d63ba47b', 'd8516235-9429-4aa4-9f54-98c666a25469') 
  AND status = 'processing';