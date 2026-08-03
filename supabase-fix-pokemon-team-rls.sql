-- ============================================================
-- FIX: Allow admin to insert/update pokemon_team for donate
-- ============================================================

-- Drop old policies
DROP POLICY IF EXISTS "pokemonteam_select" ON pokemon_team;
DROP POLICY IF EXISTS "pokemonteam_insert" ON pokemon_team;
DROP POLICY IF EXISTS "pokemonteam_update" ON pokemon_team;
DROP POLICY IF EXISTS "pokemonteam_delete" ON pokemon_team;

-- New policies: users manage their own, admins manage all
CREATE POLICY "pokemonteam_select" ON pokemon_team
    FOR SELECT USING (
        character_id IN (SELECT id FROM game_saves WHERE user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
    );

CREATE POLICY "pokemonteam_insert" ON pokemon_team
    FOR INSERT WITH CHECK (
        character_id IN (SELECT id FROM game_saves WHERE user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
    );

CREATE POLICY "pokemonteam_update" ON pokemon_team
    FOR UPDATE USING (
        character_id IN (SELECT id FROM game_saves WHERE user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
    );

CREATE POLICY "pokemonteam_delete" ON pokemon_team
    FOR DELETE USING (
        character_id IN (SELECT id FROM game_saves WHERE user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
    );
