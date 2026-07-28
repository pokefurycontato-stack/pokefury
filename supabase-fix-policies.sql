-- Fix RLS policies: allow authenticated users to insert/update

-- Abilities
DROP POLICY IF EXISTS "abilities_insert" ON abilities;
CREATE POLICY "abilities_insert" ON abilities FOR INSERT WITH CHECK (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "abilities_update" ON abilities;
CREATE POLICY "abilities_update" ON abilities FOR UPDATE USING (auth.role() = 'authenticated');

-- Pokemon Abilities
DROP POLICY IF EXISTS "pa_insert" ON pokemon_abilities;
CREATE POLICY "pa_insert" ON pokemon_abilities FOR INSERT WITH CHECK (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "pa_update" ON pokemon_abilities;
CREATE POLICY "pa_update" ON pokemon_abilities FOR UPDATE USING (auth.role() = 'authenticated');

-- Pokemon Moves v2
DROP POLICY IF EXISTS "pmv2_insert" ON pokemon_moves_v2;
CREATE POLICY "pmv2_insert" ON pokemon_moves_v2 FOR INSERT WITH CHECK (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "pmv2_update" ON pokemon_moves_v2;
CREATE POLICY "pmv2_update" ON pokemon_moves_v2 FOR UPDATE USING (auth.role() = 'authenticated');
