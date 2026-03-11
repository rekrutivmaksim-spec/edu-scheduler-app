-- Add cost column to color_type_history table
ALTER TABLE t_p29007832_virtual_fitting_room.color_type_history 
ADD COLUMN IF NOT EXISTS cost INTEGER DEFAULT 30;