ALTER TABLE clothing_catalog 
ADD COLUMN IF NOT EXISTS replicate_category VARCHAR(50) DEFAULT 'upper_body';