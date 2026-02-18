ALTER TABLE schedule ADD COLUMN week_type VARCHAR(10) DEFAULT 'every' NOT NULL;

COMMENT ON COLUMN schedule.week_type IS 'Тип недели: every (каждую), even (чётную), odd (нечётную)';