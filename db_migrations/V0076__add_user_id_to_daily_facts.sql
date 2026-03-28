
ALTER TABLE daily_facts ADD COLUMN IF NOT EXISTS user_id INTEGER;

ALTER TABLE daily_facts DROP CONSTRAINT IF EXISTS daily_facts_subject_fact_date_key;

CREATE UNIQUE INDEX IF NOT EXISTS daily_facts_user_subject_date_idx ON daily_facts (user_id, subject, fact_date);

CREATE INDEX IF NOT EXISTS daily_facts_user_id_idx ON daily_facts (user_id);
