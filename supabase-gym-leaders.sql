-- ============================================================
-- GYM LEADERS SYSTEM
-- ============================================================

-- 1. GYM REGIONS TABLE
CREATE TABLE IF NOT EXISTS gym_regions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE gym_regions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read gym regions" ON gym_regions;
CREATE POLICY "Anyone can read gym regions" ON gym_regions FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admin can manage gym regions" ON gym_regions;
CREATE POLICY "Admin can manage gym regions" ON gym_regions FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
);

-- 2. GYM LEADERS TABLE
CREATE TABLE IF NOT EXISTS gym_leaders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    region_id UUID REFERENCES gym_regions(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    gym_number INTEGER DEFAULT 1,
    type TEXT DEFAULT 'Normal',
    badge_name TEXT DEFAULT '',
    sprite_url TEXT DEFAULT '',
    map_image_url TEXT DEFAULT '',
    battle_bg_url TEXT DEFAULT '',
    map_effect TEXT DEFAULT 'none',
    dialogue TEXT DEFAULT '',
    pokemon_list JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE gym_leaders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read gym leaders" ON gym_leaders;
CREATE POLICY "Anyone can read gym leaders" ON gym_leaders FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admin can manage gym leaders" ON gym_leaders;
CREATE POLICY "Admin can manage gym leaders" ON gym_leaders FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
);

CREATE INDEX IF NOT EXISTS idx_gym_leaders_region ON gym_leaders(region_id);

-- 3. Add gym_leader_id to character_gym_badges for tracking defeated leaders
CREATE TABLE IF NOT EXISTS character_gym_badges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    character_id UUID REFERENCES game_saves(id) ON DELETE CASCADE,
    gym_leader_id UUID REFERENCES gym_leaders(id) ON DELETE CASCADE,
    defeated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(character_id, gym_leader_id)
);

ALTER TABLE character_gym_badges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own gym badges" ON character_gym_badges;
CREATE POLICY "Users can read own gym badges" ON character_gym_badges FOR SELECT USING (
    character_id IN (SELECT id FROM game_saves WHERE user_id = auth.uid())
);

DROP POLICY IF EXISTS "Users can insert own gym badges" ON character_gym_badges;
CREATE POLICY "Users can insert own gym badges" ON character_gym_badges FOR INSERT WITH CHECK (
    character_id IN (SELECT id FROM game_saves WHERE user_id = auth.uid())
);

DROP POLICY IF EXISTS "Admin can manage gym badges" ON character_gym_badges;
CREATE POLICY "Admin can manage gym badges" ON character_gym_badges FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
);
