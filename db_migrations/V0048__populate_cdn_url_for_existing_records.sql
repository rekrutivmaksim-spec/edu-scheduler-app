-- Update existing completed records with cdn_url based on user_id and task_id
UPDATE t_p29007832_virtual_fitting_room.color_type_history 
SET cdn_url = 'https://storage.yandexcloud.net/fitting-room-images/images/colortypes/' || user_id || '/' || id || '.jpg' 
WHERE status = 'completed' AND cdn_url IS NULL;