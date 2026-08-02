-- ============================================================
-- FIX: Allow admin to read all game_saves for donate feature
-- ============================================================

-- Remove old select policy
DROP POLICY IF EXISTS "gamesaves_select" ON game_saves;

-- New policy: users can see their own, admins can see all
CREATE POLICY "gamesaves_select" ON game_saves
    FOR SELECT USING (
        auth.uid() = user_id
        OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
    );

-- Also fix profiles so admin can read all usernames for donate search
DROP POLICY IF EXISTS "profiles_select_public" ON game_saves;

-- Make sure profiles are readable by everyone (for username search)
DROP POLICY IF EXISTS "profiles_select_public" ON profiles;
CREATE POLICY "profiles_select_public" ON profiles
    FOR SELECT USING (true);
