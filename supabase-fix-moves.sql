-- Fix: Drop old pokemon_moves_v2 with FK and recreate without FK
DROP TABLE IF EXISTS pokemon_moves_v2;

CREATE TABLE pokemon_moves_v2 (
    pokemon_id INTEGER NOT NULL,
    move_id INTEGER NOT NULL,
    learn_method TEXT DEFAULT 'level-up',
    level_learned INTEGER DEFAULT 0,
    PRIMARY KEY (pokemon_id, move_id, learn_method)
);

ALTER TABLE pokemon_moves_v2 ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pmv2_select" ON pokemon_moves_v2 FOR SELECT USING (true);
CREATE POLICY "pmv2_insert" ON pokemon_moves_v2 FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "pmv2_update" ON pokemon_moves_v2 FOR UPDATE USING (auth.role() = 'authenticated');

CREATE INDEX IF NOT EXISTS idx_pmv2_pokemon ON pokemon_moves_v2(pokemon_id);
CREATE INDEX IF NOT EXISTS idx_pmv2_learn ON pokemon_moves_v2(learn_method, level_learned);
