-- Создание таблиц для умных карточек

-- Таблица сетов карточек
CREATE TABLE IF NOT EXISTS flashcard_sets (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    subject VARCHAR(255) NOT NULL,
    material_ids INTEGER[] NOT NULL,
    total_cards INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_flashcard_sets_user ON flashcard_sets(user_id);
CREATE INDEX IF NOT EXISTS idx_flashcard_sets_created ON flashcard_sets(created_at DESC);

-- Таблица карточек
CREATE TABLE IF NOT EXISTS flashcards (
    id SERIAL PRIMARY KEY,
    set_id INTEGER NOT NULL,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    difficulty VARCHAR(20) NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')),
    topics TEXT[] DEFAULT '{}',
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_flashcards_set ON flashcards(set_id);
CREATE INDEX IF NOT EXISTS idx_flashcards_difficulty ON flashcards(difficulty);

-- Таблица прогресса повторений (spaced repetition)
CREATE TABLE IF NOT EXISTS flashcard_progress (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    flashcard_id INTEGER NOT NULL,
    ease_factor DECIMAL(3,2) NOT NULL DEFAULT 2.5,
    interval_days INTEGER NOT NULL DEFAULT 1,
    repetitions INTEGER NOT NULL DEFAULT 0,
    next_review_date DATE NOT NULL DEFAULT CURRENT_DATE,
    last_reviewed_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, flashcard_id)
);

CREATE INDEX IF NOT EXISTS idx_flashcard_progress_user ON flashcard_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_flashcard_progress_next_review ON flashcard_progress(next_review_date);
CREATE INDEX IF NOT EXISTS idx_flashcard_progress_user_flashcard ON flashcard_progress(user_id, flashcard_id);

COMMENT ON TABLE flashcard_sets IS 'Наборы карточек для запоминания, созданные из материалов';
COMMENT ON TABLE flashcards IS 'Отдельные карточки с вопросами и ответами';
COMMENT ON TABLE flashcard_progress IS 'Прогресс изучения карточек пользователем (spaced repetition algorithm)';
