-- Add player spawn position to region_maps
ALTER TABLE region_maps ADD COLUMN IF NOT EXISTS player_spawn_x INT;
ALTER TABLE region_maps ADD COLUMN IF NOT EXISTS player_spawn_y INT;
