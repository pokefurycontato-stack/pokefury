-- Run this in Supabase Dashboard > SQL Editor

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
CREATE POLICY "evo_select" ON pokemon_evolutions FOR SELECT USING (true);

DROP POLICY IF EXISTS "evo_insert" ON pokemon_evolutions;
CREATE POLICY "evo_insert" ON pokemon_evolutions FOR INSERT WITH CHECK (auth.role() = 'service_role');

DROP INDEX IF EXISTS idx_evo_from;
CREATE INDEX IF NOT EXISTS idx_evo_from ON pokemon_evolutions(from_pokemon_id);
