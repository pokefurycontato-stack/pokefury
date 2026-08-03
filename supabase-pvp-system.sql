-- ============================================================
-- PVP SYSTEM
-- ============================================================

-- 1. Tabela de times PVP (até 5 times por personagem)
CREATE TABLE IF NOT EXISTS pvp_teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    character_id UUID NOT NULL REFERENCES game_saves(id) ON DELETE CASCADE,
    team_name TEXT NOT NULL DEFAULT 'Time 1',
    slot_1 UUID REFERENCES pokemon_team(id),
    slot_2 UUID REFERENCES pokemon_team(id),
    slot_3 UUID REFERENCES pokemon_team(id),
    slot_4 UUID REFERENCES pokemon_team(id),
    slot_5 UUID REFERENCES pokemon_team(id),
    slot_6 UUID REFERENCES pokemon_team(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE pvp_teams ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pvp_teams_select" ON pvp_teams;
DROP POLICY IF EXISTS "pvp_teams_insert" ON pvp_teams;
DROP POLICY IF EXISTS "pvp_teams_update" ON pvp_teams;
DROP POLICY IF EXISTS "pvp_teams_delete" ON pvp_teams;

CREATE POLICY "pvp_teams_select" ON pvp_teams FOR SELECT USING (
    character_id IN (SELECT id FROM game_saves WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
);
CREATE POLICY "pvp_teams_insert" ON pvp_teams FOR INSERT WITH CHECK (
    character_id IN (SELECT id FROM game_saves WHERE user_id = auth.uid())
);
CREATE POLICY "pvp_teams_update" ON pvp_teams FOR UPDATE USING (
    character_id IN (SELECT id FROM game_saves WHERE user_id = auth.uid())
);
CREATE POLICY "pvp_teams_delete" ON pvp_teams FOR DELETE USING (
    character_id IN (SELECT id FROM game_saves WHERE user_id = auth.uid())
);

-- 2. Tabela de desafios PVP
CREATE TABLE IF NOT EXISTS pvp_challenges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    challenger_id UUID NOT NULL REFERENCES game_saves(id),
    challenger_name TEXT NOT NULL,
    challenged_id UUID NOT NULL REFERENCES game_saves(id),
    challenged_name TEXT NOT NULL,
    pvp_team_id UUID REFERENCES pvp_teams(id),
    bet_silver INTEGER DEFAULT 0,
    bet_gold INTEGER DEFAULT 0,
    bet_diamonds INTEGER DEFAULT 0,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired', 'in_progress', 'finished')),
    result TEXT CHECK (result IN ('challenger_won', 'challenged_won', 'draw')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    responded_at TIMESTAMPTZ
);

ALTER TABLE pvp_challenges ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pvp_challenges_select" ON pvp_challenges;
DROP POLICY IF EXISTS "pvp_challenges_insert" ON pvp_challenges;
DROP POLICY IF EXISTS "pvp_challenges_update" ON pvp_challenges;

CREATE POLICY "pvp_challenges_select" ON pvp_challenges FOR SELECT USING (
    challenger_id IN (SELECT id FROM game_saves WHERE user_id = auth.uid())
    OR challenged_id IN (SELECT id FROM game_saves WHERE user_id = auth.uid())
);
CREATE POLICY "pvp_challenges_insert" ON pvp_challenges FOR INSERT WITH CHECK (
    challenger_id IN (SELECT id FROM game_saves WHERE user_id = auth.uid())
);
CREATE POLICY "pvp_challenges_update" ON pvp_challenges FOR UPDATE USING (
    challenger_id IN (SELECT id FROM game_saves WHERE user_id = auth.uid())
    OR challenged_id IN (SELECT id FROM game_saves WHERE user_id = auth.uid())
);

-- 3. Tabela de estado da batalha PVP (sincronização em tempo real)
CREATE TABLE IF NOT EXISTS pvp_battle_state (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    challenge_id UUID NOT NULL REFERENCES pvp_challenges(id),
    player_id UUID NOT NULL REFERENCES game_saves(id),
    player_team JSONB NOT NULL,
    current_pokemon_index INTEGER DEFAULT 0,
    last_action TEXT,
    last_action_data JSONB,
    is_ready BOOLEAN DEFAULT false,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE pvp_battle_state ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pvp_battle_state_all" ON pvp_battle_state;
CREATE POLICY "pvp_battle_state_all" ON pvp_battle_state FOR ALL USING (true);

-- 4. Habilitar Realtime para pvp_challenges e pvp_battle_state
ALTER PUBLICATION supabase_realtime ADD TABLE pvp_challenges;
ALTER PUBLICATION supabase_realtime ADD TABLE pvp_battle_state;
