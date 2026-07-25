-- Add collision_zones and spawn_zones columns to region_maps
-- Run in Supabase SQL Editor

ALTER TABLE region_maps
    ADD COLUMN IF NOT EXISTS collision_zones JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS spawn_zones JSONB DEFAULT '[]'::jsonb;

-- collision_zones format: [{x, y, w, h}, ...] in grid coordinates (40x30)
-- spawn_zones format: [{x, y, w, h}, ...] in grid coordinates (40x30)
