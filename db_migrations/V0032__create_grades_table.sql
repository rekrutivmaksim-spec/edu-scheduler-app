
CREATE TABLE IF NOT EXISTS grade_subjects (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    name VARCHAR(255) NOT NULL,
    semester INTEGER NOT NULL DEFAULT 1,
    credit_units NUMERIC(3,1) DEFAULT 1,
    grade_type VARCHAR(20) NOT NULL DEFAULT 'exam',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS grades (
    id SERIAL PRIMARY KEY,
    subject_id INTEGER NOT NULL REFERENCES grade_subjects(id),
    user_id INTEGER NOT NULL REFERENCES users(id),
    grade INTEGER CHECK (grade >= 2 AND grade <= 5),
    grade_label VARCHAR(50),
    date DATE DEFAULT CURRENT_DATE,
    note VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_grade_subjects_user ON grade_subjects(user_id);
CREATE INDEX idx_grades_user ON grades(user_id);
CREATE INDEX idx_grades_subject ON grades(subject_id);
