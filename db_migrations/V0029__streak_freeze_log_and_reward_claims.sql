
CREATE TABLE IF NOT EXISTS streak_freeze_log (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    freeze_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, freeze_date)
);

CREATE TABLE IF NOT EXISTS streak_reward_claims (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    streak_days INTEGER NOT NULL,
    reward_type VARCHAR(50) NOT NULL,
    reward_value INTEGER NOT NULL DEFAULT 0,
    claimed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, streak_days)
);

CREATE INDEX IF NOT EXISTS idx_streak_freeze_user ON streak_freeze_log(user_id, freeze_date);
CREATE INDEX IF NOT EXISTS idx_streak_claims_user ON streak_reward_claims(user_id);
