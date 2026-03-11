
CREATE TABLE IF NOT EXISTS lookbooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    person_name VARCHAR(255) NOT NULL,
    photos TEXT[],
    color_palette VARCHAR(7)[],
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS try_on_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    person_image TEXT NOT NULL,
    garment_image TEXT NOT NULL,
    result_image TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_lookbooks_created_at ON lookbooks(created_at DESC);
CREATE INDEX idx_try_on_history_created_at ON try_on_history(created_at DESC);
