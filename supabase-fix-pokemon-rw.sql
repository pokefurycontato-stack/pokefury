-- ============================================================
-- FIX: Allow reading pokemon_team for PVP system
-- ============================================================

DROP POLICY IF EXISTS "pokemonteam_select" ON pokemon_team;
CREATE POLICY "pokemonteam_select" ON pokemon_team FOR SELECT USING (true);

DROP POLICY IF EXISTS "pokemonteam_insert" ON pokemon_team;
CREATE POLICY "pokemonteam_insert" ON pokemon_team FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "pokemonteam_update" ON pokemon_team;
CREATE POLICY "pokemonteam_update" ON pokemon_team FOR UPDATE USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "pokemonteam_delete" ON pokemon_team;
CREATE POLICY "pokemonteam_delete" ON pokemon_team FOR DELETE USING (auth.uid() IS NOT NULL);

-- Also fix pokemon_pc for the same reason
DROP POLICY IF EXISTS "pokemonpc_select" ON pokemon_pc;
CREATE POLICY "pokemonpc_select" ON pokemon_pc FOR SELECT USING (true);

-- Fix pvp_teams
DROP POLICY IF EXISTS "pvp_teams_select" ON pvp_teams;
CREATE POLICY "pvp_teams_select" ON pvp_teams FOR SELECT USING (true);
