ALTER TABLE pvp_battle_state ADD COLUMN IF NOT EXISTS round_number INTEGER DEFAULT 1;
ALTER TABLE pvp_battle_state ADD COLUMN IF NOT EXISTS pending_action JSONB;
ALTER TABLE pvp_battle_state ADD COLUMN IF NOT EXISTS resolved_round INTEGER DEFAULT 0;
