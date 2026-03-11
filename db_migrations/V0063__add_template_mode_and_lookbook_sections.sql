
ALTER TABLE t_p29007832_virtual_fitting_room.nanobananapro_tasks 
ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'standard';

ALTER TABLE t_p29007832_virtual_fitting_room.nanobananapro_tasks 
ADD COLUMN IF NOT EXISTS template_data text NULL;

ALTER TABLE t_p29007832_virtual_fitting_room.lookbooks 
ADD COLUMN IF NOT EXISTS capsule_photos text[] NOT NULL DEFAULT '{}';

ALTER TABLE t_p29007832_virtual_fitting_room.lookbooks 
ADD COLUMN IF NOT EXISTS grid_photos text[] NOT NULL DEFAULT '{}';
