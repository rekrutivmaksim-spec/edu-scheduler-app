-- Добавляем поле для типа файла и размера
ALTER TABLE materials 
ADD COLUMN file_type VARCHAR(50),
ADD COLUMN file_size INTEGER,
ADD COLUMN total_chunks INTEGER DEFAULT 1;

-- Переименовываем image_url в file_url для универсальности
ALTER TABLE materials 
RENAME COLUMN image_url TO file_url;

-- Создаем таблицу для хранения чанков больших документов
CREATE TABLE IF NOT EXISTS document_chunks (
    id SERIAL PRIMARY KEY,
    material_id INTEGER NOT NULL REFERENCES materials(id),
    chunk_index INTEGER NOT NULL,
    chunk_text TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(material_id, chunk_index)
);

CREATE INDEX idx_document_chunks_material_id ON document_chunks(material_id);

-- Обновляем существующие записи (если есть)
UPDATE materials 
SET file_type = 'image/jpeg', 
    file_size = 0, 
    total_chunks = 1
WHERE file_type IS NULL;