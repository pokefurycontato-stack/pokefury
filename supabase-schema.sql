-- =============================================
-- PokeFury Database Schema v3
-- Execute no SQL Editor do Supabase
-- =============================================

-- =============================================
-- TABELAS EXISTENTES
-- =============================================

CREATE TABLE IF NOT EXISTS pokemon (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    types TEXT[] NOT NULL,
    hp INTEGER NOT NULL,
    attack INTEGER NOT NULL,
    defense INTEGER NOT NULL,
    sp_atk INTEGER NOT NULL,
    sp_def INTEGER NOT NULL,
    speed INTEGER NOT NULL,
    sprite_front TEXT,
    sprite_back TEXT,
    sprite_official TEXT,
    sprite_home TEXT,
    sprite_front_shiny TEXT,
    sprite_back_shiny TEXT,
    sprite_official_shiny TEXT,
    sprite_home_shiny TEXT,
    variant TEXT DEFAULT 'normal',
    base_pokemon_id INTEGER,
    mega_stone TEXT,
    model_3d TEXT,
    model_3d_shiny TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS moves (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    category TEXT NOT NULL,
    power INTEGER,
    accuracy INTEGER,
    pp INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pokemon_moves (
    pokemon_id INTEGER REFERENCES pokemon(id) ON DELETE CASCADE,
    move_id INTEGER REFERENCES moves(id) ON DELETE CASCADE,
    PRIMARY KEY (pokemon_id, move_id)
);

CREATE TABLE IF NOT EXISTS type_effectiveness (
    attack_type TEXT NOT NULL,
    defense_type TEXT NOT NULL,
    multiplier NUMERIC(3,1) NOT NULL DEFAULT 1.0,
    PRIMARY KEY (attack_type, defense_type)
);

-- =============================================
-- ITENS (EXPANDIDO)
-- =============================================

CREATE TABLE IF NOT EXISTS items (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    category TEXT NOT NULL,
    subcategory TEXT,
    effect TEXT,
    effect_value INTEGER DEFAULT 0,
    description TEXT,
    price INTEGER DEFAULT 0,
    sprite_url TEXT,
    holdable BOOLEAN DEFAULT false,
    usable_in_battle BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS player_inventory (
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    item_id INTEGER REFERENCES items(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 1,
    PRIMARY KEY (user_id, item_id)
);

-- =============================================
-- NATURES
-- =============================================

CREATE TABLE IF NOT EXISTS natures (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    increased_stat TEXT,
    decreased_stat TEXT
);

-- =============================================
-- EGG GROUPS
-- =============================================

CREATE TABLE IF NOT EXISTS egg_groups (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS pokemon_egg_groups (
    pokemon_id INTEGER REFERENCES pokemon(id) ON DELETE CASCADE,
    egg_group_id INTEGER REFERENCES egg_groups(id) ON DELETE CASCADE,
    PRIMARY KEY (pokemon_id, egg_group_id)
);

CREATE TABLE IF NOT EXISTS egg_moves (
    pokemon_id INTEGER REFERENCES pokemon(id) ON DELETE CASCADE,
    move_id INTEGER REFERENCES moves(id) ON DELETE CASCADE,
    PRIMARY KEY (pokemon_id, move_id)
);

-- =============================================
-- MEGA EVOLUTIONS
-- =============================================

CREATE TABLE IF NOT EXISTS mega_evolutions (
    base_pokemon_id INTEGER NOT NULL,
    mega_pokemon_id INTEGER NOT NULL REFERENCES pokemon(id),
    mega_stone_item TEXT NOT NULL,
    required_level INTEGER DEFAULT 0,
    PRIMARY KEY (base_pokemon_id, mega_pokemon_id)
);

-- =============================================
-- EVOLUTION CHAINS
-- =============================================

CREATE TABLE IF NOT EXISTS evolution_chains (
    id SERIAL PRIMARY KEY,
    species_id INTEGER NOT NULL
);

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

-- =============================================
-- pokemon_team: IVs, EVs, Nature, Held Item
-- =============================================

ALTER TABLE pokemon_team ADD COLUMN IF NOT EXISTS iv_hp INTEGER DEFAULT 15;
ALTER TABLE pokemon_team ADD COLUMN IF NOT EXISTS iv_attack INTEGER DEFAULT 15;
ALTER TABLE pokemon_team ADD COLUMN IF NOT EXISTS iv_defense INTEGER DEFAULT 15;
ALTER TABLE pokemon_team ADD COLUMN IF NOT EXISTS iv_sp_atk INTEGER DEFAULT 15;
ALTER TABLE pokemon_team ADD COLUMN IF NOT EXISTS iv_sp_def INTEGER DEFAULT 15;
ALTER TABLE pokemon_team ADD COLUMN IF NOT EXISTS iv_speed INTEGER DEFAULT 15;
ALTER TABLE pokemon_team ADD COLUMN IF NOT EXISTS ev_hp INTEGER DEFAULT 0;
ALTER TABLE pokemon_team ADD COLUMN IF NOT EXISTS ev_attack INTEGER DEFAULT 0;
ALTER TABLE pokemon_team ADD COLUMN IF NOT EXISTS ev_defense INTEGER DEFAULT 0;
ALTER TABLE pokemon_team ADD COLUMN IF NOT EXISTS ev_sp_atk INTEGER DEFAULT 0;
ALTER TABLE pokemon_team ADD COLUMN IF NOT EXISTS ev_sp_def INTEGER DEFAULT 0;
ALTER TABLE pokemon_team ADD COLUMN IF NOT EXISTS ev_speed INTEGER DEFAULT 0;
ALTER TABLE pokemon_team ADD COLUMN IF NOT EXISTS nature TEXT DEFAULT 'hardy';
ALTER TABLE pokemon_team ADD COLUMN IF NOT EXISTS pokemon_id INTEGER;
ALTER TABLE pokemon_team ADD COLUMN IF NOT EXISTS happiness INTEGER DEFAULT 70;
ALTER TABLE pokemon_team ADD COLUMN IF NOT EXISTS held_item_id INTEGER;
ALTER TABLE pokemon_team ADD COLUMN IF NOT EXISTS is_shiny BOOLEAN DEFAULT false;
ALTER TABLE pokemon_team ADD COLUMN IF NOT EXISTS is_mega BOOLEAN DEFAULT false;

-- =============================================
-- INDICES
-- =============================================

CREATE INDEX IF NOT EXISTS idx_pokemon_name ON pokemon(name);
CREATE INDEX IF NOT EXISTS idx_pokemon_variant ON pokemon(variant);
CREATE INDEX IF NOT EXISTS idx_pokemon_base ON pokemon(base_pokemon_id);
CREATE INDEX IF NOT EXISTS idx_pokemon_moves_pokemon ON pokemon_moves(pokemon_id);
CREATE INDEX IF NOT EXISTS idx_pokemon_moves_move ON pokemon_moves(move_id);
CREATE INDEX IF NOT EXISTS idx_type_eff_attack ON type_effectiveness(attack_type);
CREATE INDEX IF NOT EXISTS idx_items_category ON items(category);
CREATE INDEX IF NOT EXISTS idx_items_subcategory ON items(subcategory);
CREATE INDEX IF NOT EXISTS idx_pokemon_egg_groups_pokemon ON pokemon_egg_groups(pokemon_id);
CREATE INDEX IF NOT EXISTS idx_pokemon_egg_groups_group ON pokemon_egg_groups(egg_group_id);
CREATE INDEX IF NOT EXISTS idx_egg_moves_pokemon ON egg_moves(pokemon_id);
CREATE INDEX IF NOT EXISTS idx_mega_base ON mega_evolutions(base_pokemon_id);
CREATE INDEX IF NOT EXISTS idx_evo_from ON pokemon_evolutions(from_pokemon_id);

-- =============================================
-- RLS
-- =============================================

ALTER TABLE pokemon ENABLE ROW LEVEL SECURITY;
ALTER TABLE moves ENABLE ROW LEVEL SECURITY;
ALTER TABLE pokemon_moves ENABLE ROW LEVEL SECURITY;
ALTER TABLE type_effectiveness ENABLE ROW LEVEL SECURITY;
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE natures ENABLE ROW LEVEL SECURITY;
ALTER TABLE egg_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE pokemon_egg_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE egg_moves ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE mega_evolutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE pokemon_evolutions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    DROP POLICY IF EXISTS "pokemon_select" ON pokemon;
    DROP POLICY IF EXISTS "pokemon_insert" ON pokemon;
    DROP POLICY IF EXISTS "moves_select" ON moves;
    DROP POLICY IF EXISTS "moves_insert" ON moves;
    DROP POLICY IF EXISTS "pokemon_moves_select" ON pokemon_moves;
    DROP POLICY IF EXISTS "pokemon_moves_insert" ON pokemon_moves;
    DROP POLICY IF EXISTS "type_effectiveness_select" ON type_effectiveness;
    DROP POLICY IF EXISTS "type_effectiveness_insert" ON type_effectiveness;
    DROP POLICY IF EXISTS "items_select" ON items;
    DROP POLICY IF EXISTS "items_insert" ON items;
    DROP POLICY IF EXISTS "natures_select" ON natures;
    DROP POLICY IF EXISTS "natures_insert" ON natures;
    DROP POLICY IF EXISTS "egg_groups_select" ON egg_groups;
    DROP POLICY IF EXISTS "egg_groups_insert" ON egg_groups;
    DROP POLICY IF EXISTS "pokemon_egg_groups_select" ON pokemon_egg_groups;
    DROP POLICY IF EXISTS "pokemon_egg_groups_insert" ON pokemon_egg_groups;
    DROP POLICY IF EXISTS "egg_moves_select" ON egg_moves;
    DROP POLICY IF EXISTS "egg_moves_insert" ON egg_moves;
    DROP POLICY IF EXISTS "inventory_select" ON player_inventory;
    DROP POLICY IF EXISTS "inventory_insert" ON player_inventory;
    DROP POLICY IF EXISTS "inventory_update" ON player_inventory;
    DROP POLICY IF EXISTS "inventory_delete" ON player_inventory;
    DROP POLICY IF EXISTS "mega_select" ON mega_evolutions;
    DROP POLICY IF EXISTS "mega_insert" ON mega_evolutions;
    DROP POLICY IF EXISTS "evo_select" ON pokemon_evolutions;
    DROP POLICY IF EXISTS "evo_insert" ON pokemon_evolutions;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "pokemon_select" ON pokemon FOR SELECT USING (true);
CREATE POLICY "pokemon_insert" ON pokemon FOR INSERT WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "moves_select" ON moves FOR SELECT USING (true);
CREATE POLICY "moves_insert" ON moves FOR INSERT WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "pokemon_moves_select" ON pokemon_moves FOR SELECT USING (true);
CREATE POLICY "pokemon_moves_insert" ON pokemon_moves FOR INSERT WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "type_effectiveness_select" ON type_effectiveness FOR SELECT USING (true);
CREATE POLICY "type_effectiveness_insert" ON type_effectiveness FOR INSERT WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "items_select" ON items FOR SELECT USING (true);
CREATE POLICY "items_insert" ON items FOR INSERT WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "natures_select" ON natures FOR SELECT USING (true);
CREATE POLICY "natures_insert" ON natures FOR INSERT WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "egg_groups_select" ON egg_groups FOR SELECT USING (true);
CREATE POLICY "egg_groups_insert" ON egg_groups FOR INSERT WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "pokemon_egg_groups_select" ON pokemon_egg_groups FOR SELECT USING (true);
CREATE POLICY "pokemon_egg_groups_insert" ON pokemon_egg_groups FOR INSERT WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "egg_moves_select" ON egg_moves FOR SELECT USING (true);
CREATE POLICY "egg_moves_insert" ON egg_moves FOR INSERT WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "mega_select" ON mega_evolutions FOR SELECT USING (true);
CREATE POLICY "mega_insert" ON mega_evolutions FOR INSERT WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "evo_select" ON pokemon_evolutions FOR SELECT USING (true);
CREATE POLICY "evo_insert" ON pokemon_evolutions FOR INSERT WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "inventory_select" ON player_inventory FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "inventory_insert" ON player_inventory FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "inventory_update" ON player_inventory FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "inventory_delete" ON player_inventory FOR DELETE USING (auth.uid() = user_id);

-- =============================================
-- 3D MODEL COLUMNS (execute if upgrading)
-- =============================================
ALTER TABLE pokemon ADD COLUMN IF NOT EXISTS model_3d TEXT;
ALTER TABLE pokemon ADD COLUMN IF NOT EXISTS model_3d_shiny TEXT;
