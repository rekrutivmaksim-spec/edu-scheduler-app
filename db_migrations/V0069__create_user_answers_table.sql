
CREATE TABLE IF NOT EXISTS user_answers (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  subject TEXT NOT NULL,
  topic TEXT NOT NULL,
  question TEXT NOT NULL,
  user_answer TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL DEFAULT FALSE,
  ai_feedback TEXT,
  source TEXT NOT NULL DEFAULT 'session',
  mode TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_answers_user_subject ON user_answers (user_id, subject);
CREATE INDEX IF NOT EXISTS idx_user_answers_user_correct ON user_answers (user_id, is_correct);
CREATE INDEX IF NOT EXISTS idx_user_answers_created ON user_answers (created_at DESC);
