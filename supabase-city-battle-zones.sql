CREATE TABLE IF NOT EXISTS city_battle_zones (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    zone_name TEXT NOT NULL DEFAULT 'Batalha',
    pos_x NUMERIC NOT NULL DEFAULT 0,
    pos_y NUMERIC NOT NULL DEFAULT 0,
    width NUMERIC NOT NULL DEFAULT 128,
    height NUMERIC NOT NULL DEFAULT 128,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE city_battle_zones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on city_battle_zones" ON city_battle_zones
    FOR ALL USING (true) WITH CHECK (true);
