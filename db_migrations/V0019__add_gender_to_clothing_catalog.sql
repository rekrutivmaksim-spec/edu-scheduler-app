-- Add gender field to clothing_catalog table
ALTER TABLE t_p29007832_virtual_fitting_room.clothing_catalog
ADD COLUMN gender VARCHAR(20) DEFAULT 'unisex';

COMMENT ON COLUMN t_p29007832_virtual_fitting_room.clothing_catalog.gender IS 'Gender category: male, female, or unisex';
