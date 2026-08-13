-- ============================================================
-- PRESENCA v2: online em qualquer acao (janela de 5 min) + auto-farm
-- ============================================================

-- Status de auto-farm (AFK)
ALTER TABLE game_saves ADD COLUMN IF NOT EXISTS is_auto_farming BOOLEAN DEFAULT false;

-- RPC: ligar/desligar auto-farm
CREATE OR REPLACE FUNCTION set_auto_farming(p_character_id UUID, p_active BOOLEAN)
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
  UPDATE game_saves SET is_auto_farming = p_active, last_seen = NOW() WHERE id = p_character_id;
  RETURN json_build_object('ok', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Online = alguma acao nos ultimos 5 minutos
DROP FUNCTION IF EXISTS is_character_online(UUID);
CREATE OR REPLACE FUNCTION is_character_online(p_character_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_online BOOLEAN;
BEGIN
  SELECT (COALESCE(last_seen, updated_at) > NOW() - INTERVAL '5 minutes') INTO v_online
  FROM game_saves WHERE id = p_character_id;
  RETURN COALESCE(v_online, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Busca com status online + auto-farm calculados no servidor
DROP FUNCTION IF EXISTS search_players_online(TEXT);
CREATE OR REPLACE FUNCTION search_players_online(p_query TEXT)
RETURNS TABLE (
  id UUID,
  player_name TEXT,
  user_id UUID,
  is_online BOOLEAN,
  is_auto_farming BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT gs.id, gs.player_name, gs.user_id,
         (COALESCE(gs.last_seen, gs.updated_at) > NOW() - INTERVAL '5 minutes') AS is_online,
         COALESCE(gs.is_auto_farming, false) AS is_auto_farming
  FROM game_saves gs
  WHERE gs.player_name ILIKE '%' || p_query || '%'
  ORDER BY gs.updated_at DESC
  LIMIT 10;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;
