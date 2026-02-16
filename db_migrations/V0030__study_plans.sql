
CREATE TABLE study_plans (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    subject VARCHAR(255) NOT NULL,
    exam_date DATE NOT NULL,
    difficulty VARCHAR(20) NOT NULL DEFAULT 'medium',
    total_days INTEGER NOT NULL DEFAULT 7,
    plan_data JSONB NOT NULL DEFAULT '[]',
    progress_percent INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE study_plan_days (
    id SERIAL PRIMARY KEY,
    plan_id INTEGER NOT NULL REFERENCES study_plans(id),
    day_number INTEGER NOT NULL,
    day_date DATE NOT NULL,
    title VARCHAR(255) NOT NULL,
    topics TEXT NOT NULL,
    study_minutes INTEGER NOT NULL DEFAULT 60,
    is_completed BOOLEAN NOT NULL DEFAULT false,
    completed_at TIMESTAMP,
    notes TEXT
);

CREATE INDEX idx_study_plans_user ON study_plans(user_id);
CREATE INDEX idx_study_plan_days_plan ON study_plan_days(plan_id);
