-- ============================================================
-- FIX PVP Teams - Remove FK constraints for pokemon slots
-- Os pokémons podem vir do time (pokemon_team) ou do PC (pokemon_pc)
-- ============================================================

-- Remover foreign keys das colunas slot
DO $$ BEGIN ALTER TABLE pvp_teams DROP CONSTRAINT IF EXISTS pvp_teams_slot_1_fkey; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE pvp_teams DROP CONSTRAINT IF EXISTS pvp_teams_slot_2_fkey; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE pvp_teams DROP CONSTRAINT IF EXISTS pvp_teams_slot_3_fkey; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE pvp_teams DROP CONSTRAINT IF EXISTS pvp_teams_slot_4_fkey; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE pvp_teams DROP CONSTRAINT IF EXISTS pvp_teams_slot_5_fkey; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE pvp_teams DROP CONSTRAINT IF EXISTS pvp_teams_slot_6_fkey; EXCEPTION WHEN OTHERS THEN NULL; END $$;
