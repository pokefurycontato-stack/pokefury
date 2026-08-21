-- ============================================================
-- ADMIN BYPASS: permite que o admin leia time e beneficios
-- de outros jogadores no painel admin.
-- Rode este SQL no Supabase Dashboard > SQL Editor
-- ============================================================

-- 1. pokemon_team: admin pode SELECT de todos os jogadores
DROP POLICY IF EXISTS "pokemonteam_select" ON pokemon_team;
CREATE POLICY "pokemonteam_select" ON pokemon_team
  FOR SELECT USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.is_admin = true
    )
  );

-- Bloqueios de escrita mantidos (so RPCs podem escrever)
DROP POLICY IF EXISTS "pokemonteam_block_insert" ON pokemon_team;
DROP POLICY IF EXISTS "pokemonteam_block_update" ON pokemon_team;
DROP POLICY IF EXISTS "pokemonteam_block_delete" ON pokemon_team;
CREATE POLICY "pokemonteam_block_insert" ON pokemon_team FOR INSERT WITH CHECK (false);
CREATE POLICY "pokemonteam_block_update" ON pokemon_team FOR UPDATE USING (false);
CREATE POLICY "pokemonteam_block_delete" ON pokemon_team FOR DELETE USING (false);

-- 2. character_boosts: admin pode SELECT de todos os jogadores
DROP POLICY IF EXISTS "boosts_select" ON character_boosts;
CREATE POLICY "boosts_select" ON character_boosts
  FOR SELECT USING (
    character_id IN (SELECT id FROM game_saves WHERE user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.is_admin = true
    )
  );

-- Bloqueios de escrita mantidos
DROP POLICY IF EXISTS "boosts_block_insert" ON character_boosts;
DROP POLICY IF EXISTS "boosts_block_update" ON character_boosts;
DROP POLICY IF EXISTS "boosts_block_delete" ON character_boosts;
CREATE POLICY "boosts_block_insert" ON character_boosts FOR INSERT WITH CHECK (false);
CREATE POLICY "boosts_block_update" ON character_boosts FOR UPDATE USING (false);
CREATE POLICY "boosts_block_delete" ON character_boosts FOR DELETE USING (false);
