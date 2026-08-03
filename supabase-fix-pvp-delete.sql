-- ============================================================
-- FIX: Allow delete of pvp_teams even if referenced by challenges
-- ============================================================

-- Remover FK de pvp_challenges se existir
DO $$ BEGIN
    ALTER TABLE pvp_challenges DROP CONSTRAINT IF EXISTS pvp_challenges_pvp_team_id_fkey;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Remover FK de pvp_battle_state se existir
DO $$ BEGIN
    ALTER TABLE pvp_battle_state DROP CONSTRAINT IF EXISTS pvp_battle_state_challenge_id_fkey;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
