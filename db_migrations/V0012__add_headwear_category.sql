-- Add "Головные уборы" category
INSERT INTO clothing_categories (name) VALUES ('Головные уборы')
ON CONFLICT (name) DO NOTHING;