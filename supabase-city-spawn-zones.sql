-- Tabela de zonas de spawn na cidade
-- Cada zona representa uma área onde podem ocorrer encontros/combates

CREATE TABLE IF NOT EXISTS city_spawn_zones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pos_x FLOAT NOT NULL DEFAULT 0,
    pos_y FLOAT NOT NULL DEFAULT 0,
    width FLOAT NOT NULL DEFAULT 128,
    height FLOAT NOT NULL DEFAULT 128,
    region_map_id UUID REFERENCES region_maps(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE city_spawn_zones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on city_spawn_zones" ON city_spawn_zones
    FOR ALL USING (true) WITH CHECK (true);
