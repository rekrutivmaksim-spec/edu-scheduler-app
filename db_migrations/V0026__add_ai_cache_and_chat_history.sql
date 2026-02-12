-- Таблица для кэширования похожих вопросов (экономия токенов + быстрые ответы)
CREATE TABLE IF NOT EXISTS ai_question_cache (
    id SERIAL PRIMARY KEY,
    question_hash VARCHAR(64) NOT NULL,  -- MD5/SHA256 хэш нормализованного вопроса
    question_text TEXT NOT NULL,         -- Оригинальный текст вопроса
    answer TEXT NOT NULL,                -- Кэшированный ответ
    material_ids INTEGER[],              -- Массив ID материалов, использованных для ответа
    tokens_used INTEGER DEFAULT 0,       -- Сколько токенов потрачено на этот ответ
    hit_count INTEGER DEFAULT 1,         -- Сколько раз этот ответ использовался из кэша
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(question_hash)
);

-- Индекс для быстрого поиска по хэшу
CREATE INDEX idx_ai_cache_hash ON ai_question_cache(question_hash);
CREATE INDEX idx_ai_cache_last_used ON ai_question_cache(last_used_at DESC);

-- Таблица для истории чатов (диалогов)
CREATE TABLE IF NOT EXISTS chat_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    title VARCHAR(255),                  -- Заголовок чата (первый вопрос, обрезанный)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    message_count INTEGER DEFAULT 0
);

-- Индексы для быстрого поиска чатов пользователя
CREATE INDEX idx_chat_sessions_user ON chat_sessions(user_id, updated_at DESC);

-- Таблица для сообщений в чатах
CREATE TABLE IF NOT EXISTS chat_messages (
    id SERIAL PRIMARY KEY,
    session_id INTEGER NOT NULL REFERENCES chat_sessions(id),
    user_id INTEGER NOT NULL REFERENCES users(id),
    role VARCHAR(20) NOT NULL,           -- 'user' или 'assistant'
    content TEXT NOT NULL,               -- Текст сообщения
    material_ids INTEGER[],              -- Какие материалы использовались (для user messages)
    tokens_used INTEGER DEFAULT 0,       -- Сколько токенов потрачено (для assistant messages)
    was_cached BOOLEAN DEFAULT FALSE,    -- Был ли ответ взят из кэша
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Индексы для быстрой загрузки сообщений
CREATE INDEX idx_chat_messages_session ON chat_messages(session_id, created_at ASC);
CREATE INDEX idx_chat_messages_user ON chat_messages(user_id);

-- Комментарии для документации
COMMENT ON TABLE ai_question_cache IS 'Кэш популярных вопросов для экономии токенов и ускорения ответов';
COMMENT ON TABLE chat_sessions IS 'Сессии чатов пользователей с ИИ-ассистентом';
COMMENT ON TABLE chat_messages IS 'Сообщения в чатах (история диалогов)';