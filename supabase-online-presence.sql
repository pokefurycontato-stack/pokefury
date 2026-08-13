-- ============================================================
-- ONLINE PRESENCE (heartbeat + last_seen)
-- ============================================================

-- 1. Coluna de "ultima vez visto" (presenca em tempo real)
ALTER TABLE game_saves ADD COLUMN IF NOT EXISTS last_seen TIMESTAMPTZ;
UPDATE game_saves SET last_seen = updated_at WHERE last_seen IS NULL;
ALTER TABLE game_saves ALTER COLUMN last_seen SET DEFAULT NOW();

-- 2. RPC de heartbeat: o client chama a cada ~30s enquanto o personagem esta carregado
CREATE OR REPLACE FUNCTION heartbeat_character(p_character_id UUID)
RETURNS JSON AS $$
DECLARE
  v_owner UUID;
BEGIN
  SELECT user_id INTO v_owner FROM game_saves WHERE id = p_character_id;
  IF v_owner IS NULL THEN
    RETURN json_build_object('error', 'Character not found');
  END IF;
  IF v_owner != auth.uid() THEN
    RETURN json_build_object('error', 'Unauthorized');
  END IF;

  UPDATE game_saves SET last_seen = NOW() WHERE id = p_character_id;
  RETURN json_build_object('ok', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
