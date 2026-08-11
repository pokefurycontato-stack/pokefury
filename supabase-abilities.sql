-- Abilities table
CREATE TABLE IF NOT EXISTS abilities (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    generation INTEGER,
    effect TEXT
);
ALTER TABLE abilities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "abilities_select" ON abilities;
CREATE POLICY "abilities_select" ON abilities FOR SELECT USING (true);
DROP POLICY IF EXISTS "abilities_insert" ON abilities;
CREATE POLICY "abilities_insert" ON abilities FOR INSERT WITH CHECK (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "abilities_update" ON abilities;
CREATE POLICY "abilities_update" ON abilities FOR UPDATE USING (auth.role() = 'authenticated');

-- Pokemon Abilities junction table
CREATE TABLE IF NOT EXISTS pokemon_abilities (
    pokemon_id INTEGER REFERENCES pokemon(id) ON DELETE CASCADE,
    ability_id INTEGER REFERENCES abilities(id) ON DELETE CASCADE,
    is_hidden BOOLEAN DEFAULT false,
    slot INTEGER DEFAULT 1,
    PRIMARY KEY (pokemon_id, ability_id)
);
ALTER TABLE pokemon_abilities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pa_select" ON pokemon_abilities;
CREATE POLICY "pa_select" ON pokemon_abilities FOR SELECT USING (true);
DROP POLICY IF EXISTS "pa_insert" ON pokemon_abilities;
CREATE POLICY "pa_insert" ON pokemon_abilities FOR INSERT WITH CHECK (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "pa_update" ON pokemon_abilities;
CREATE POLICY "pa_update" ON pokemon_abilities FOR UPDATE USING (auth.role() = 'authenticated');

-- Pokemon Moves with level and learn method (no FK to moves - PokeAPI IDs may not match)
CREATE TABLE IF NOT EXISTS pokemon_moves_v2 (
    pokemon_id INTEGER NOT NULL,
    move_id INTEGER NOT NULL,
    learn_method TEXT DEFAULT 'level-up',
    level_learned INTEGER DEFAULT 0,
    PRIMARY KEY (pokemon_id, move_id, learn_method)
);
ALTER TABLE pokemon_moves_v2 ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pmv2_select" ON pokemon_moves_v2;
CREATE POLICY "pmv2_select" ON pokemon_moves_v2 FOR SELECT USING (true);
DROP POLICY IF EXISTS "pmv2_insert" ON pokemon_moves_v2;
CREATE POLICY "pmv2_insert" ON pokemon_moves_v2 FOR INSERT WITH CHECK (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "pmv2_update" ON pokemon_moves_v2;
CREATE POLICY "pmv2_update" ON pokemon_moves_v2 FOR UPDATE USING (auth.role() = 'authenticated');

-- Indexes
CREATE INDEX IF NOT EXISTS idx_pa_pokemon ON pokemon_abilities(pokemon_id);
CREATE INDEX IF NOT EXISTS idx_pa_ability ON pokemon_abilities(ability_id);
CREATE INDEX IF NOT EXISTS idx_pmv2_pokemon ON pokemon_moves_v2(pokemon_id);
CREATE INDEX IF NOT EXISTS idx_pmv2_learn ON pokemon_moves_v2(learn_method, level_learned);
