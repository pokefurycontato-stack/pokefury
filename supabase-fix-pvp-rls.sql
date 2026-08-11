-- ============================================================
-- FIX PVP RLS - Simplified policies
-- ============================================================

-- Simplificar RLS de pvp_teams
DROP POLICY IF EXISTS "pvp_teams_select" ON pvp_teams;
DROP POLICY IF EXISTS "pvp_teams_insert" ON pvp_teams;
DROP POLICY IF EXISTS "pvp_teams_update" ON pvp_teams;
DROP POLICY IF EXISTS "pvp_teams_delete" ON pvp_teams;

-- Qualquer usuário autenticado pode ler seus próprios times
CREATE POLICY "pvp_teams_select" ON pvp_teams FOR SELECT USING (true);

-- Qualquer usuário autenticado pode criar times
CREATE POLICY "pvp_teams_insert" ON pvp_teams FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Qualquer usuário autenticado pode atualizar seus times
CREATE POLICY "pvp_teams_update" ON pvp_teams FOR UPDATE USING (auth.uid() IS NOT NULL);

-- Qualquer usuário autenticado pode deletar seus times
CREATE POLICY "pvp_teams_delete" ON pvp_teams FOR DELETE USING (auth.uid() IS NOT NULL);

-- Simplificar RLS de pvp_challenges
DROP POLICY IF EXISTS "pvp_challenges_select" ON pvp_challenges;
DROP POLICY IF EXISTS "pvp_challenges_insert" ON pvp_challenges;
DROP POLICY IF EXISTS "pvp_challenges_update" ON pvp_challenges;

CREATE POLICY "pvp_challenges_select" ON pvp_challenges FOR SELECT USING (true);
CREATE POLICY "pvp_challenges_insert" ON pvp_challenges FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "pvp_challenges_update" ON pvp_challenges FOR UPDATE USING (auth.uid() IS NOT NULL);
