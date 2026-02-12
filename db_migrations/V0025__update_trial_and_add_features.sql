-- Добавляем новые поля для новой системы лимитов и функций
ALTER TABLE users ADD COLUMN IF NOT EXISTS daily_questions_used integer DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS daily_questions_reset_at timestamp DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS bonus_questions integer DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code varchar(20) UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by integer REFERENCES users(id);
ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_count integer DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_rewards_earned integer DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS tutor_savings_rub integer DEFAULT 0;

-- Таблица для отслеживания покупок микро-пакетов
CREATE TABLE IF NOT EXISTS question_packs (
    id SERIAL PRIMARY KEY,
    user_id integer NOT NULL REFERENCES users(id),
    pack_type varchar(50) NOT NULL,
    questions_count integer NOT NULL,
    price_rub integer NOT NULL,
    payment_id integer REFERENCES payments(id),
    purchased_at timestamp DEFAULT CURRENT_TIMESTAMP,
    expires_at timestamp
);

-- Таблица для сезонных тарифов
CREATE TABLE IF NOT EXISTS seasonal_subscriptions (
    id SERIAL PRIMARY KEY,
    user_id integer NOT NULL REFERENCES users(id),
    season_type varchar(20) NOT NULL,
    started_at timestamp DEFAULT CURRENT_TIMESTAMP,
    expires_at timestamp NOT NULL,
    price_rub integer NOT NULL,
    payment_id integer REFERENCES payments(id)
);

-- Обновляем существующих пользователей: сбрасываем триал
UPDATE users 
SET trial_ends_at = NULL, 
    is_trial_used = false,
    daily_questions_used = 0,
    daily_questions_reset_at = CURRENT_TIMESTAMP
WHERE is_trial_used = false OR trial_ends_at IS NULL;

-- Генерируем реферальные коды для существующих пользователей
UPDATE users 
SET referral_code = UPPER(SUBSTRING(MD5(RANDOM()::text || id::text) FROM 1 FOR 8))
WHERE referral_code IS NULL;