-- Добавление поля color_type_ai для хранения результата ИИ-анализа
ALTER TABLE color_type_history 
ADD COLUMN IF NOT EXISTS color_type_ai VARCHAR(50);