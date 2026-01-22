-- Таблица для хранения учебных материалов (фото конспектов, доски и т.д.)
CREATE TABLE materials (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    title VARCHAR(500) NOT NULL,
    subject VARCHAR(200),
    image_url TEXT NOT NULL,
    recognized_text TEXT,
    summary TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_materials_user_id ON materials(user_id);
CREATE INDEX idx_materials_subject ON materials(subject);
CREATE INDEX idx_materials_created_at ON materials(created_at DESC);