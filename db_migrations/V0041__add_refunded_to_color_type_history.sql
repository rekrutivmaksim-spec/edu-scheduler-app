-- Add refunded column to color_type_history to prevent double refunds
ALTER TABLE color_type_history 
ADD COLUMN IF NOT EXISTS refunded BOOLEAN DEFAULT FALSE;