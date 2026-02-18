ALTER TABLE tasks ADD COLUMN recurrence VARCHAR(20) DEFAULT NULL;
ALTER TABLE tasks ADD COLUMN recurrence_day INTEGER DEFAULT NULL;
ALTER TABLE tasks ADD COLUMN parent_task_id INTEGER DEFAULT NULL;

COMMENT ON COLUMN tasks.recurrence IS 'Повторение: daily, weekly, biweekly, monthly, или NULL';
COMMENT ON COLUMN tasks.recurrence_day IS 'День недели для weekly (1-7) или день месяца (1-31)';
COMMENT ON COLUMN tasks.parent_task_id IS 'ID родительской задачи для серии повторений';

CREATE INDEX idx_tasks_recurrence ON tasks(recurrence) WHERE recurrence IS NOT NULL;
CREATE INDEX idx_tasks_parent ON tasks(parent_task_id) WHERE parent_task_id IS NOT NULL;