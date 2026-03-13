CREATE TABLE IF NOT EXISTS daily_login_bonuses (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    bonus_date DATE NOT NULL,
    bonus_questions INTEGER NOT NULL DEFAULT 1,
    xp_earned INTEGER NOT NULL DEFAULT 10,
    streak_day INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, bonus_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_login_bonuses_user_date ON daily_login_bonuses(user_id, bonus_date);