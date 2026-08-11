-- =============================================
-- PokeFury Schema v3 - ALTER TABLE for variants
-- Execute no SQL Editor do Supabase ANTES do seed v3
-- Adiciona colunas de shiny/variant à tabela pokemon existente
-- =============================================

-- Shiny sprites
ALTER TABLE pokemon ADD COLUMN IF NOT EXISTS sprite_front_shiny TEXT;
ALTER TABLE pokemon ADD COLUMN IF NOT EXISTS sprite_official_shiny TEXT;
ALTER TABLE pokemon ADD COLUMN IF NOT EXISTS sprite_home_shiny TEXT;

-- Variant system
ALTER TABLE pokemon ADD COLUMN IF NOT EXISTS variant TEXT DEFAULT 'normal';
ALTER TABLE pokemon ADD COLUMN IF NOT EXISTS base_pokemon_id INTEGER;
ALTER TABLE pokemon ADD COLUMN IF NOT EXISTS mega_stone TEXT;

-- Item system expansion (subcategory already exists in v3 schema)
-- If items table was already created with old schema, add missing columns:
ALTER TABLE items ADD COLUMN IF NOT EXISTS subcategory TEXT;
ALTER TABLE items ADD COLUMN IF NOT EXISTS effect_value INTEGER DEFAULT 0;
ALTER TABLE items ADD COLUMN IF NOT EXISTS holdable BOOLEAN DEFAULT false;
ALTER TABLE items ADD COLUMN IF NOT EXISTS usable_in_battle BOOLEAN DEFAULT false;

-- mega_evolutions table (may not exist yet)
CREATE TABLE IF NOT EXISTS mega_evolutions (
    base_pokemon_id INTEGER NOT NULL,
    mega_pokemon_id INTEGER NOT NULL REFERENCES pokemon(id),
    mega_stone_item TEXT NOT NULL,
    required_level INTEGER DEFAULT 0,
    PRIMARY KEY (base_pokemon_id, mega_pokemon_id)
);
ALTER TABLE mega_evolutions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "mega_select" ON mega_evolutions;
DROP POLICY IF EXISTS "mega_insert" ON mega_evolutions;
CREATE POLICY "mega_select" ON mega_evolutions FOR SELECT USING (true);
CREATE POLICY "mega_insert" ON mega_evolutions FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- pokemon_evolutions table (may not exist yet)
CREATE TABLE IF NOT EXISTS pokemon_evolutions (
    id SERIAL PRIMARY KEY,
    from_pokemon_id INTEGER REFERENCES pokemon(id),
    to_pokemon_id INTEGER REFERENCES pokemon(id),
    evolution_method TEXT,
    evolution_value TEXT,
    held_item TEXT,
    trade_pokemon BOOLEAN DEFAULT false,
    min_happiness INTEGER DEFAULT 0,
    min_level INTEGER DEFAULT 0,
    time_of_day TEXT
);
ALTER TABLE pokemon_evolutions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "evo_select" ON pokemon_evolutions;
DROP POLICY IF EXISTS "evo_insert" ON pokemon_evolutions;
CREATE POLICY "evo_select" ON pokemon_evolutions FOR SELECT USING (true);
CREATE POLICY "evo_insert" ON pokemon_evolutions FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- Indexes for variants
CREATE INDEX IF NOT EXISTS idx_pokemon_variant ON pokemon(variant);
CREATE INDEX IF NOT EXISTS idx_pokemon_base ON pokemon(base_pokemon_id);
CREATE INDEX IF NOT EXISTS idx_mega_base ON mega_evolutions(base_pokemon_id);
CREATE INDEX IF NOT EXISTS idx_evo_from ON pokemon_evolutions(from_pokemon_id);
