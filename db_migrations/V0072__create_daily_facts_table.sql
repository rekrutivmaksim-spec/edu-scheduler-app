CREATE TABLE IF NOT EXISTS daily_facts (
    id SERIAL PRIMARY KEY,
    subject VARCHAR(50) NOT NULL,
    fact_text TEXT NOT NULL,
    emoji VARCHAR(10) NOT NULL DEFAULT '🧠',
    fact_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(subject, fact_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_facts_date ON daily_facts(fact_date DESC, subject);