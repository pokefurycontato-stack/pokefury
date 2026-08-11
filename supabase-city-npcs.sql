CREATE TABLE IF NOT EXISTS city_npcs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    npc_type TEXT NOT NULL DEFAULT 'region_selector',
    pos_x NUMERIC NOT NULL DEFAULT 0,
    pos_y NUMERIC NOT NULL DEFAULT 0,
    width NUMERIC NOT NULL DEFAULT 64,
    height NUMERIC NOT NULL DEFAULT 64,
    interaction_width NUMERIC NOT NULL DEFAULT 128,
    interaction_height NUMERIC NOT NULL DEFAULT 128,
    name TEXT NOT NULL DEFAULT 'NPC',
    sprite_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE city_npcs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on city_npcs" ON city_npcs
    FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_city_npcs_type ON city_npcs(npc_type);
