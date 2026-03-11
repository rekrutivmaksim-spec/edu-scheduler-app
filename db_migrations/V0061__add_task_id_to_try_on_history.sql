-- Добавляем колонку task_id для связи с nanobananapro_tasks
ALTER TABLE t_p29007832_virtual_fitting_room.try_on_history 
ADD COLUMN task_id TEXT;

-- Создаём частичный уникальный индекс
-- WHERE task_id IS NOT NULL защищает старые записи (у них task_id будет NULL)
CREATE UNIQUE INDEX unique_tryon_task_id 
ON t_p29007832_virtual_fitting_room.try_on_history(task_id) 
WHERE task_id IS NOT NULL;

-- Добавляем комментарий для документации
COMMENT ON COLUMN t_p29007832_virtual_fitting_room.try_on_history.task_id 
IS 'UUID задачи из nanobananapro_tasks для предотвращения дублей';
