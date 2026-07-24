-- =============================================
-- PokeFury Database Schema
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
    sprite_official TEXT,
    sprite_home TEXT,
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
    multiplier NUMERIC(3,1) NOT NULL NULL DEFAULT 1.0,
    PRIMARY KEY (attack_type, defense_type)
);

-- =============================================
-- NOVAS TABELAS: ITENS
-- =============================================

CREATE TABLE IF NOT EXISTS items (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    category TEXT NOT NULL,
    effect TEXT,
    description TEXT,
    price INTEGER DEFAULT 0,
    sprite_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Inventário do jogador
CREATE TABLE IF NOT EXISTS player_inventory (
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    item_id INTEGER REFERENCES items(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 1,
    PRIMARY KEY (user_id, item_id)
);

-- =============================================
-- NOVAS TABELAS: NATURES
-- =============================================

CREATE TABLE IF NOT EXISTS natures (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    increased_stat TEXT,
    decreased_stat TEXT
);

-- =============================================
-- NOVAS TABELAS: EGG GROUPS
-- =============================================

CREATE TABLE IF NOT EXISTS egg_groups (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE
);

-- Quais Pokemon pertencem a quais egg groups (1 ou 2)
CREATE TABLE IF NOT EXISTS pokemon_egg_groups (
    pokemon_id INTEGER REFERENCES pokemon(id) ON DELETE CASCADE,
    egg_group_id INTEGER REFERENCES egg_groups(id) ON DELETE CASCADE,
    PRIMARY KEY (pokemon_id, egg_group_id)
);

-- Movimentos de ovo
CREATE TABLE IF NOT EXISTS egg_moves (
    pokemon_id INTEGER REFERENCES pokemon(id) ON DELETE CASCADE,
    move_id INTEGER REFERENCES moves(id) ON DELETE CASCADE,
    PRIMARY KEY (pokemon_id, move_id)
);

-- =============================================
-- ATUALIZAR: pokemon_team com IVs, EVs, Nature
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

-- =============================================
-- INDICES
-- =============================================

CREATE INDEX IF NOT EXISTS idx_pokemon_name ON pokemon(name);
CREATE INDEX IF NOT EXISTS idx_pokemon_moves_pokemon ON pokemon_moves(pokemon_id);
CREATE INDEX IF NOT EXISTS idx_pokemon_moves_move ON pokemon_moves(move_id);
CREATE INDEX IF NOT EXISTS idx_type_eff_attack ON type_effectiveness(attack_type);
CREATE INDEX IF NOT EXISTS idx_items_category ON items(category);
CREATE INDEX IF NOT EXISTS idx_pokemon_egg_groups_pokemon ON pokemon_egg_groups(pokemon_id);
CREATE INDEX IF NOT EXISTS idx_pokemon_egg_groups_group ON pokemon_egg_groups(egg_group_id);
CREATE INDEX IF NOT EXISTS idx_egg_moves_pokemon ON egg_moves(pokemon_id);

-- =============================================
-- RLS (Row Level Security)
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

-- Drop existing policies before recreating
DO $$ BEGIN
    DROP POLICY IF EXISTS "pokemon_select" ON pokemon;
    DROP POLICY IF EXISTS "moves_select" ON moves;
    DROP POLICY IF EXISTS "pokemon_moves_select" ON pokemon_moves;
    DROP POLICY IF EXISTS "type_effectiveness_select" ON type_effectiveness;
    DROP POLICY IF EXISTS "items_select" ON items;
    DROP POLICY IF EXISTS "natures_select" ON natures;
    DROP POLICY IF EXISTS "egg_groups_select" ON egg_groups;
    DROP POLICY IF EXISTS "pokemon_egg_groups_select" ON pokemon_egg_groups;
    DROP POLICY IF EXISTS "egg_moves_select" ON egg_moves;
    DROP POLICY IF EXISTS "inventory_select" ON player_inventory;
    DROP POLICY IF EXISTS "inventory_insert" ON player_inventory;
    DROP POLICY IF EXISTS "inventory_update" ON player_inventory;
    DROP POLICY IF EXISTS "inventory_delete" ON player_inventory;
    DROP POLICY IF EXISTS "pokemon_insert" ON pokemon;
    DROP POLICY IF EXISTS "moves_insert" ON moves;
    DROP POLICY IF EXISTS "pokemon_moves_insert" ON pokemon_moves;
    DROP POLICY IF EXISTS "type_effectiveness_insert" ON type_effectiveness;
    DROP POLICY IF EXISTS "items_insert" ON items;
    DROP POLICY IF EXISTS "natures_insert" ON natures;
    DROP POLICY IF EXISTS "egg_groups_insert" ON egg_groups;
    DROP POLICY IF EXISTS "pokemon_egg_groups_insert" ON pokemon_egg_groups;
    DROP POLICY IF EXISTS "egg_moves_insert" ON egg_moves;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Leitura pública (game data)
CREATE POLICY "pokemon_select" ON pokemon FOR SELECT USING (true);
CREATE POLICY "moves_select" ON moves FOR SELECT USING (true);
CREATE POLICY "pokemon_moves_select" ON pokemon_moves FOR SELECT USING (true);
CREATE POLICY "type_effectiveness_select" ON type_effectiveness FOR SELECT USING (true);
CREATE POLICY "items_select" ON items FOR SELECT USING (true);
CREATE POLICY "natures_select" ON natures FOR SELECT USING (true);
CREATE POLICY "egg_groups_select" ON egg_groups FOR SELECT USING (true);
CREATE POLICY "pokemon_egg_groups_select" ON pokemon_egg_groups FOR SELECT USING (true);
CREATE POLICY "egg_moves_select" ON egg_moves FOR SELECT USING (true);

-- Inventory: cada usuário só vê o seu
CREATE POLICY "inventory_select" ON player_inventory FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "inventory_insert" ON player_inventory FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "inventory_update" ON player_inventory FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "inventory_delete" ON player_inventory FOR DELETE USING (auth.uid() = user_id);

-- Admin inserts (game data)
CREATE POLICY "pokemon_insert" ON pokemon FOR INSERT WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "moves_insert" ON moves FOR INSERT WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "pokemon_moves_insert" ON pokemon_moves FOR INSERT WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "type_effectiveness_insert" ON type_effectiveness FOR INSERT WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "items_insert" ON items FOR INSERT WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "natures_insert" ON natures FOR INSERT WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "egg_groups_insert" ON egg_groups FOR INSERT WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "pokemon_egg_groups_insert" ON pokemon_egg_groups FOR INSERT WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "egg_moves_insert" ON egg_moves FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- =============================================
-- VIEWS
-- =============================================

CREATE OR REPLACE VIEW pokemon_with_moves AS
SELECT
    p.id, p.name, p.types,
    p.hp, p.attack, p.defense, p.sp_atk, p.sp_def, p.speed,
    p.sprite_front, p.sprite_official, p.sprite_home,
    json_agg(json_build_object(
        'id', m.id, 'name', m.name, 'type', m.type,
        'category', m.category, 'power', m.power, 'accuracy', m.accuracy, 'pp', m.pp
    )) AS moves
FROM pokemon p
LEFT JOIN pokemon_moves pm ON p.id = pm.pokemon_id
LEFT JOIN moves m ON pm.move_id = m.id
GROUP BY p.id;
