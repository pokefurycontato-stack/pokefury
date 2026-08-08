-- ============================================================
-- SPAWN POINTS NA CIDADE
-- Pontos exatos onde pokemons aparecem andando pela cidade.
-- O bioma e herdado da spawn zone que contem o ponto.
-- ============================================================

CREATE TABLE IF NOT EXISTS city_spawn_points (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pos_x FLOAT NOT NULL DEFAULT 0,
    pos_y FLOAT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE city_spawn_points ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on city_spawn_points" ON city_spawn_points
    FOR ALL USING (true) WITH CHECK (true);
