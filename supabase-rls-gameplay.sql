-- =============================================
-- RLS Policies para tabelas de gameplay
-- Execute no SQL Editor do Supabase
-- =============================================

-- game_saves
ALTER TABLE game_saves ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    DROP POLICY IF EXISTS "gamesaves_select" ON game_saves;
    DROP POLICY IF EXISTS "gamesaves_insert" ON game_saves;
    DROP POLICY IF EXISTS "gamesaves_update" ON game_saves;
    DROP POLICY IF EXISTS "gamesaves_delete" ON game_saves;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "gamesaves_select" ON game_saves FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "gamesaves_insert" ON game_saves FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "gamesaves_update" ON game_saves FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "gamesaves_delete" ON game_saves FOR DELETE USING (auth.uid() = user_id);

-- pokemon_team
ALTER TABLE pokemon_team ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    DROP POLICY IF EXISTS "pokemonteam_select" ON pokemon_team;
    DROP POLICY IF EXISTS "pokemonteam_insert" ON pokemon_team;
    DROP POLICY IF EXISTS "pokemonteam_update" ON pokemon_team;
    DROP POLICY IF EXISTS "pokemonteam_delete" ON pokemon_team;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "pokemonteam_select" ON pokemon_team FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "pokemonteam_insert" ON pokemon_team FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "pokemonteam_update" ON pokemon_team FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "pokemonteam_delete" ON pokemon_team FOR DELETE USING (auth.uid() = user_id);

-- battle_history
ALTER TABLE battle_history ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    DROP POLICY IF EXISTS "battlehistory_select" ON battle_history;
    DROP POLICY IF EXISTS "battlehistory_insert" ON battle_history;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "battlehistory_select" ON battle_history FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "battlehistory_insert" ON battle_history FOR INSERT WITH CHECK (auth.uid() = user_id);
