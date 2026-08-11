-- ============================================================
-- FIX URGENTE: Admin pode ver todos os game_saves e profiles
-- Execute este SQL no Supabase SQL Editor
-- ============================================================

-- 1. Permitir que TODO mundo leia game_saves (necessário para donate)
DROP POLICY IF EXISTS "gamesaves_select" ON game_saves;
CREATE POLICY "gamesaves_select" ON game_saves FOR SELECT USING (true);

-- 2. Permitir que TODO mundo leia profiles (necessário para busca)
DROP POLICY IF EXISTS "profiles_select_public" ON profiles;
CREATE POLICY "profiles_select_public" ON profiles FOR SELECT USING (true);

-- 3. Manter proteção para insert/update/delete
-- (só o próprio usuário pode modificar seus dados)
DROP POLICY IF EXISTS "gamesaves_insert" ON game_saves;
CREATE POLICY "gamesaves_insert" ON game_saves FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "gamesaves_update" ON game_saves;
CREATE POLICY "gamesaves_update" ON game_saves FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "gamesaves_delete" ON game_saves;
CREATE POLICY "gamesaves_delete" ON game_saves FOR DELETE USING (auth.uid() = user_id);
