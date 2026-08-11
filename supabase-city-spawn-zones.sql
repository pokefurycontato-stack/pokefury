-- ============================================================
-- SPAWN ZONES NA CIDADE
-- Cada zona representa uma area de encontros selvagens.
-- O spawn usa o BIOMA; os encontros sao resolvidos pelo
-- bioma + regiao atual do treinador em cidade.js
-- ============================================================

CREATE TABLE IF NOT EXISTS city_spawn_zones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pos_x FLOAT NOT NULL DEFAULT 0,
    pos_y FLOAT NOT NULL DEFAULT 0,
    width FLOAT NOT NULL DEFAULT 128,
    height FLOAT NOT NULL DEFAULT 128,
    biome TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE city_spawn_zones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on city_spawn_zones" ON city_spawn_zones
    FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- Migracao para instalacoes ja existentes:
-- 1) Remove a coluna antiga (se existir) e garante a biome
-- ============================================================
ALTER TABLE city_spawn_zones DROP COLUMN IF EXISTS region_map_id;
ALTER TABLE city_spawn_zones ADD COLUMN IF NOT EXISTS biome TEXT;
