-- =============================================
-- PokeFury Database Schema
-- Execute no SQL Editor do Supabase
-- =============================================

-- Tabela de Pokemon
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

-- Tabela de Movimentos
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

-- Quais Pokemon aprendem quais movimentos
CREATE TABLE IF NOT EXISTS pokemon_moves (
    pokemon_id INTEGER REFERENCES pokemon(id) ON DELETE CASCADE,
    move_id INTEGER REFERENCES moves(id) ON DELETE CASCADE,
    PRIMARY KEY (pokemon_id, move_id)
);

-- Tabela de efetividade de tipos
CREATE TABLE IF NOT EXISTS type_effectiveness (
    attack_type TEXT NOT NULL,
    defense_type TEXT NOT NULL,
    multiplier NUMERIC(3,1) NOT NULL DEFAULT 1.0,
    PRIMARY KEY (attack_type, defense_type)
);

-- Indices para performance
CREATE INDEX IF NOT EXISTS idx_pokemon_name ON pokemon(name);
CREATE INDEX IF NOT EXISTS idx_pokemon_moves_pokemon ON pokemon_moves(pokemon_id);
CREATE INDEX IF NOT EXISTS idx_pokemon_moves_move ON pokemon_moves(move_id);
CREATE INDEX IF NOT EXISTS idx_type_eff_attack ON type_effectiveness(attack_type);

-- RLS (Row Level Security) - leitura pública
ALTER TABLE pokemon ENABLE ROW LEVEL SECURITY;
ALTER TABLE moves ENABLE ROW LEVEL SECURITY;
ALTER TABLE pokemon_moves ENABLE ROW LEVEL SECURITY;
ALTER TABLE type_effectiveness ENABLE ROW LEVEL SECURITY;

-- Políticas de leitura pública (qualquer um pode ler)
CREATE POLICY "pokemon_select" ON pokemon FOR SELECT USING (true);
CREATE POLICY "moves_select" ON moves FOR SELECT USING (true);
CREATE POLICY "pokemon_moves_select" ON pokemon_moves FOR SELECT USING (true);
CREATE POLICY "type_effectiveness_select" ON type_effectiveness FOR SELECT USING (true);

-- Políticas de inserção/apenas service_role (admin)
CREATE POLICY "pokemon_insert" ON pokemon FOR INSERT WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "moves_insert" ON moves FOR INSERT WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "pokemon_moves_insert" ON pokemon_moves FOR INSERT WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "type_effectiveness_insert" ON type_effectiveness FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- View para查询方便
CREATE OR REPLACE VIEW pokemon_with_moves AS
SELECT
    p.id,
    p.name,
    p.types,
    p.hp, p.attack, p.defense, p.sp_atk, p.sp_def, p.speed,
    p.sprite_front, p.sprite_official, p.sprite_home,
    json_agg(json_build_object(
        'id', m.id,
        'name', m.name,
        'type', m.type,
        'category', m.category,
        'power', m.power,
        'accuracy', m.accuracy,
        'pp', m.pp
    )) AS moves
FROM pokemon p
LEFT JOIN pokemon_moves pm ON p.id = pm.pokemon_id
LEFT JOIN moves m ON pm.move_id = m.id
GROUP BY p.id;
