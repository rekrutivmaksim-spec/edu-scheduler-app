
CREATE TABLE user_streaks (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    current_streak INTEGER NOT NULL DEFAULT 0,
    longest_streak INTEGER NOT NULL DEFAULT 0,
    last_activity_date DATE,
    streak_freeze_available INTEGER NOT NULL DEFAULT 0,
    streak_freeze_used_at DATE,
    total_active_days INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id)
);

CREATE TABLE daily_activity (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    activity_date DATE NOT NULL DEFAULT CURRENT_DATE,
    tasks_completed INTEGER NOT NULL DEFAULT 0,
    pomodoro_minutes INTEGER NOT NULL DEFAULT 0,
    ai_questions_asked INTEGER NOT NULL DEFAULT 0,
    materials_uploaded INTEGER NOT NULL DEFAULT 0,
    schedule_views INTEGER NOT NULL DEFAULT 0,
    xp_earned INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, activity_date)
);

CREATE TABLE achievements (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) NOT NULL UNIQUE,
    title VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    icon VARCHAR(50) NOT NULL,
    category VARCHAR(30) NOT NULL DEFAULT 'general',
    xp_reward INTEGER NOT NULL DEFAULT 0,
    requirement_type VARCHAR(50) NOT NULL,
    requirement_value INTEGER NOT NULL DEFAULT 1,
    is_premium BOOLEAN NOT NULL DEFAULT false,
    sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE user_achievements (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    achievement_id INTEGER NOT NULL REFERENCES achievements(id),
    unlocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, achievement_id)
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS xp_total INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS level INTEGER NOT NULL DEFAULT 1;

INSERT INTO achievements (code, title, description, icon, category, xp_reward, requirement_type, requirement_value, sort_order) VALUES
('streak_3', 'Три дня подряд', 'Заходи 3 дня подряд', 'Flame', 'streak', 50, 'streak_days', 3, 1),
('streak_7', 'Неделя огня', 'Заходи 7 дней подряд', 'Flame', 'streak', 150, 'streak_days', 7, 2),
('streak_14', 'Две недели!', 'Заходи 14 дней подряд', 'Flame', 'streak', 300, 'streak_days', 14, 3),
('streak_30', 'Месяц без перерыва', 'Заходи 30 дней подряд', 'Flame', 'streak', 500, 'streak_days', 30, 4),
('streak_60', '60 дней легенды', 'Заходи 60 дней подряд', 'Trophy', 'streak', 1000, 'streak_days', 60, 5),
('streak_100', 'Стодневка', 'Заходи 100 дней подряд', 'Diamond', 'streak', 2000, 'streak_days', 100, 6),
('tasks_1', 'Первая задача', 'Выполни первую задачу', 'CheckCircle', 'tasks', 20, 'tasks_completed', 1, 10),
('tasks_10', 'Десяточка', 'Выполни 10 задач', 'CheckCircle', 'tasks', 100, 'tasks_completed', 10, 11),
('tasks_50', 'Полсотни', 'Выполни 50 задач', 'Target', 'tasks', 300, 'tasks_completed', 50, 12),
('tasks_100', 'Сотня', 'Выполни 100 задач', 'Award', 'tasks', 500, 'tasks_completed', 100, 13),
('tasks_500', 'Машина продуктивности', 'Выполни 500 задач', 'Trophy', 'tasks', 1500, 'tasks_completed', 500, 14),
('pomodoro_60', 'Первый час', 'Учись 60 минут через Помодоро', 'Timer', 'study', 50, 'pomodoro_minutes', 60, 20),
('pomodoro_300', '5 часов фокуса', 'Учись 300 минут через Помодоро', 'Timer', 'study', 200, 'pomodoro_minutes', 300, 21),
('pomodoro_1000', 'Мастер концентрации', 'Учись 1000 минут через Помодоро', 'Brain', 'study', 500, 'pomodoro_minutes', 1000, 22),
('pomodoro_5000', 'Легенда фокуса', '5000 минут Помодоро', 'Crown', 'study', 2000, 'pomodoro_minutes', 5000, 23),
('ai_1', 'Первый вопрос', 'Задай первый вопрос ИИ', 'Bot', 'ai', 20, 'ai_questions', 1, 30),
('ai_25', 'Любопытный', 'Задай 25 вопросов ИИ', 'Bot', 'ai', 150, 'ai_questions', 25, 31),
('ai_100', 'Исследователь', 'Задай 100 вопросов ИИ', 'Telescope', 'ai', 400, 'ai_questions', 100, 32),
('materials_1', 'Первый конспект', 'Загрузи первый материал', 'FileText', 'materials', 30, 'materials_uploaded', 1, 40),
('materials_10', 'Библиотекарь', 'Загрузи 10 материалов', 'Library', 'materials', 200, 'materials_uploaded', 10, 41),
('materials_50', 'Архивариус', 'Загрузи 50 материалов', 'BookOpen', 'materials', 800, 'materials_uploaded', 50, 42),
('level_5', 'Уровень 5', 'Достигни 5 уровня', 'Star', 'level', 0, 'level_reached', 5, 50),
('level_10', 'Уровень 10', 'Достигни 10 уровня', 'Star', 'level', 0, 'level_reached', 10, 51),
('level_25', 'Уровень 25', 'Достигни 25 уровня', 'Sparkles', 'level', 0, 'level_reached', 25, 52),
('level_50', 'Уровень 50', 'Достигни 50 уровня', 'Crown', 'level', 0, 'level_reached', 50, 53),
('referral_1', 'Первый друг', 'Пригласи первого друга', 'Users', 'social', 100, 'referrals', 1, 60),
('referral_5', 'Популярный', 'Пригласи 5 друзей', 'Users', 'social', 300, 'referrals', 5, 61),
('referral_10', 'Лидер', 'Пригласи 10 друзей', 'Crown', 'social', 600, 'referrals', 10, 62),
('first_login', 'Добро пожаловать!', 'Зайди в Studyfay впервые', 'Rocket', 'special', 10, 'first_login', 1, 70),
('night_owl', 'Ночная сова', 'Учись после полуночи', 'Moon', 'special', 50, 'night_activity', 1, 71),
('early_bird', 'Ранняя пташка', 'Учись до 7 утра', 'Sun', 'special', 50, 'morning_activity', 1, 72);

CREATE INDEX idx_user_streaks_user ON user_streaks(user_id);
CREATE INDEX idx_daily_activity_user_date ON daily_activity(user_id, activity_date);
CREATE INDEX idx_user_achievements_user ON user_achievements(user_id);
