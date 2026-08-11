-- =============================================
-- REGIONS & MAP SEQUENCES
-- Run in Supabase SQL Editor
-- =============================================

-- 1. Regions table
CREATE TABLE IF NOT EXISTS regions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Region maps (ordered sequence within a region)
CREATE TABLE IF NOT EXISTS region_maps (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    region_id UUID NOT NULL REFERENCES regions(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    image_url TEXT NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    encounter_rate INT DEFAULT 15,
    min_level INT DEFAULT 2,
    max_level INT DEFAULT 8,
    is_gym BOOLEAN DEFAULT false,
    gym_leader TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Wild encounters per map
CREATE TABLE IF NOT EXISTS map_encounters (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    map_id UUID NOT NULL REFERENCES region_maps(id) ON DELETE CASCADE,
    pokemon_name TEXT NOT NULL,
    pokemon_id INT NOT NULL,
    weight INT DEFAULT 50,
    min_level INT,
    max_level INT,
    is_shiny BOOLEAN DEFAULT false,
    sprite_url TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Player progress (which region/map they're at)
CREATE TABLE IF NOT EXISTS player_progress (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    character_id UUID NOT NULL REFERENCES game_saves(id) ON DELETE CASCADE,
    current_region_id UUID REFERENCES regions(id),
    current_map_id UUID REFERENCES region_maps(id),
    map_index INT DEFAULT 0,
    UNIQUE(character_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_region_maps_region ON region_maps(region_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_map_encounters_map ON map_encounters(map_id);
CREATE INDEX IF NOT EXISTS idx_player_progress_character ON player_progress(character_id);

-- RLS
ALTER TABLE regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE region_maps ENABLE ROW LEVEL SECURITY;
ALTER TABLE map_encounters ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_progress ENABLE ROW LEVEL SECURITY;

-- Regions: everyone can read, only admin can write
DROP POLICY IF EXISTS "regions_select" ON regions;
CREATE POLICY "regions_select" ON regions FOR SELECT USING (true);

DROP POLICY IF EXISTS "regions_insert" ON regions;
CREATE POLICY "regions_insert" ON regions FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
);

DROP POLICY IF EXISTS "regions_update" ON regions;
CREATE POLICY "regions_update" ON regions FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
);

DROP POLICY IF EXISTS "regions_delete" ON regions;
CREATE POLICY "regions_delete" ON regions FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
);

-- Region maps: everyone can read, only admin can write
DROP POLICY IF EXISTS "region_maps_select" ON region_maps;
CREATE POLICY "region_maps_select" ON region_maps FOR SELECT USING (true);

DROP POLICY IF EXISTS "region_maps_insert" ON region_maps;
CREATE POLICY "region_maps_insert" ON region_maps FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
);

DROP POLICY IF EXISTS "region_maps_update" ON region_maps;
CREATE POLICY "region_maps_update" ON region_maps FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
);

DROP POLICY IF EXISTS "region_maps_delete" ON region_maps;
CREATE POLICY "region_maps_delete" ON region_maps FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
);

-- Map encounters: everyone can read, only admin can write
DROP POLICY IF EXISTS "map_encounters_select" ON map_encounters;
CREATE POLICY "map_encounters_select" ON map_encounters FOR SELECT USING (true);

DROP POLICY IF EXISTS "map_encounters_insert" ON map_encounters;
CREATE POLICY "map_encounters_insert" ON map_encounters FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
);

DROP POLICY IF EXISTS "map_encounters_update" ON map_encounters;
CREATE POLICY "map_encounters_update" ON map_encounters FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
);

DROP POLICY IF EXISTS "map_encounters_delete" ON map_encounters;
CREATE POLICY "map_encounters_delete" ON map_encounters FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
);

-- Player progress: players can read/write their own
DROP POLICY IF EXISTS "progress_select" ON player_progress;
CREATE POLICY "progress_select" ON player_progress FOR SELECT USING (
    character_id IN (SELECT id FROM game_saves WHERE user_id = auth.uid())
);

DROP POLICY IF EXISTS "progress_insert" ON player_progress;
CREATE POLICY "progress_insert" ON player_progress FOR INSERT WITH CHECK (
    character_id IN (SELECT id FROM game_saves WHERE user_id = auth.uid())
);

DROP POLICY IF EXISTS "progress_update" ON player_progress;
CREATE POLICY "progress_update" ON player_progress FOR UPDATE USING (
    character_id IN (SELECT id FROM game_saves WHERE user_id = auth.uid())
);
