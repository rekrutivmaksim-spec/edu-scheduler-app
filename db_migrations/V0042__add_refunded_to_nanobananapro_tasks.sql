-- Add refunded column to nanobananapro_tasks to prevent double refunds
ALTER TABLE nanobananapro_tasks 
ADD COLUMN IF NOT EXISTS refunded BOOLEAN DEFAULT FALSE;