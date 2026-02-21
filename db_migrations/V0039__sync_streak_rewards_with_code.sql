-- Приводим streak_rewards в БД к единому стандарту с STREAK_REWARDS в gamification/index.py
-- Источник истины: код (gamification/index.py строки 18-28)

INSERT INTO streak_rewards (streak_days, reward_type, reward_value, title, description, is_premium_bonus) VALUES
(3,   'bonus_questions', 5,   '3 дня подряд',    '+5 вопросов к ИИ',               false),
(7,   'bonus_questions', 10,  'Неделя стрика',    '+10 вопросов к ИИ',              false),
(14,  'bonus_questions', 20,  '2 недели подряд',  '+20 вопросов к ИИ',              false),
(21,  'premium_days',    3,   '3 недели стрика',  '3 дня Premium бесплатно',        true),
(30,  'premium_days',    7,   'Месяц стрика',     '7 дней Premium бесплатно',       true),
(60,  'premium_days',    14,  '2 месяца стрика',  '14 дней Premium бесплатно',      true),
(90,  'premium_days',    30,  '3 месяца стрика',  '30 дней Premium бесплатно',      true),
(180, 'premium_days',    60,  'Полгода стрика',   '60 дней Premium бесплатно',      true),
(365, 'premium_days',    180, 'Год стрика',       '180 дней Premium бесплатно',     true)
ON CONFLICT (streak_days) DO UPDATE SET
    reward_type = EXCLUDED.reward_type,
    reward_value = EXCLUDED.reward_value,
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    is_premium_bonus = EXCLUDED.is_premium_bonus;
