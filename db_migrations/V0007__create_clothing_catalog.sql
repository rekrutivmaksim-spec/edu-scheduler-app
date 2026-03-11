-- Таблица категорий одежды
CREATE TABLE clothing_categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Таблица цветовых групп
CREATE TABLE color_groups (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Таблица архетипов Киббе
CREATE TABLE kibbe_archetypes (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Каталог одежды
CREATE TABLE clothing_catalog (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    image_url TEXT NOT NULL,
    name VARCHAR(200),
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Связи: одежда - категории (многие ко многим)
CREATE TABLE clothing_category_links (
    clothing_id UUID REFERENCES clothing_catalog(id),
    category_id INTEGER REFERENCES clothing_categories(id),
    PRIMARY KEY (clothing_id, category_id)
);

-- Связи: одежда - цвета (многие ко многим)
CREATE TABLE clothing_color_links (
    clothing_id UUID REFERENCES clothing_catalog(id),
    color_group_id INTEGER REFERENCES color_groups(id),
    PRIMARY KEY (clothing_id, color_group_id)
);

-- Связи: одежда - архетипы (многие ко многим)
CREATE TABLE clothing_archetype_links (
    clothing_id UUID REFERENCES clothing_catalog(id),
    archetype_id INTEGER REFERENCES kibbe_archetypes(id),
    PRIMARY KEY (clothing_id, archetype_id)
);

-- Вставляем стандартные категории
INSERT INTO clothing_categories (name) VALUES 
    ('Платья'),
    ('Блузки'),
    ('Топы'),
    ('Брюки'),
    ('Юбки'),
    ('Жакеты'),
    ('Пальто'),
    ('Джинсы'),
    ('Шорты'),
    ('Обувь'),
    ('Аксессуары');

-- Вставляем цветовые группы
INSERT INTO color_groups (name) VALUES 
    ('Теплые'),
    ('Холодные'),
    ('Яркие'),
    ('Мягкие'),
    ('Светлые'),
    ('Темные');

-- Вставляем архетипы Киббе
INSERT INTO kibbe_archetypes (name) VALUES 
    ('Драматик'),
    ('Романтик'),
    ('Классик'),
    ('Гамин'),
    ('Натурал');