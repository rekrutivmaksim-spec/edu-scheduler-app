
CREATE TABLE daily_quests (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    quest_date DATE NOT NULL DEFAULT CURRENT_DATE,
    quest_type VARCHAR(50) NOT NULL,
    quest_title VARCHAR(200) NOT NULL,
    quest_description TEXT,
    target_value INTEGER NOT NULL DEFAULT 1,
    current_value INTEGER NOT NULL DEFAULT 0,
    xp_reward INTEGER NOT NULL DEFAULT 0,
    is_completed BOOLEAN NOT NULL DEFAULT false,
    is_premium_only BOOLEAN NOT NULL DEFAULT false,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, quest_date, quest_type)
);

CREATE TABLE streak_rewards (
    id SERIAL PRIMARY KEY,
    streak_days INTEGER NOT NULL UNIQUE,
    reward_type VARCHAR(50) NOT NULL,
    reward_value INTEGER NOT NULL DEFAULT 0,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    is_premium_bonus BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE user_streak_rewards (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    streak_reward_id INTEGER NOT NULL REFERENCES streak_rewards(id),
    claimed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, streak_reward_id)
);

ALTER TABLE notification_settings ADD COLUMN IF NOT EXISTS streak_reminder BOOLEAN DEFAULT true;
ALTER TABLE notification_settings ADD COLUMN IF NOT EXISTS streak_reminder_time TIME DEFAULT '20:00:00';

ALTER TABLE user_streaks ADD COLUMN IF NOT EXISTS streak_freeze_used_today BOOLEAN DEFAULT false;

INSERT INTO streak_rewards (streak_days, reward_type, reward_value, title, description, is_premium_bonus) VALUES
(3, 'bonus_questions', 2, '3 дня подряд!', '+2 бонусных AI-вопроса', false),
(7, 'bonus_questions', 5, 'Неделя огня!', '+5 бонусных AI-вопросов', false),
(14, 'xp_multiplier', 2, '2 недели!', 'x2 XP на 24 часа', false),
(21, 'bonus_questions', 10, '3 недели подряд!', '+10 бонусных AI-вопросов', false),
(30, 'bonus_questions', 15, 'Месяц без перерыва!', '+15 бонусных AI-вопросов + заморозка стрика', false),
(60, 'bonus_questions', 25, '60 дней легенды!', '+25 бонусных AI-вопросов', false),
(100, 'premium_days', 7, 'Стодневка!', '7 дней Premium бесплатно!', true);

CREATE INDEX idx_daily_quests_user_date ON daily_quests(user_id, quest_date);
CREATE INDEX idx_user_streak_rewards_user ON user_streak_rewards(user_id);
