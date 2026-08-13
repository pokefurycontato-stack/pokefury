-- ============================================================
-- ONLINE CHECK NO SERVIDOR (evita problema de fuso horario no client)
-- ============================================================

-- Checa se um personagem esta online (last_seen nos ultimos 90s)
CREATE OR REPLACE FUNCTION is_character_online(p_character_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_online BOOLEAN;
BEGIN
  SELECT (COALESCE(last_seen, updated_at) > NOW() - INTERVAL '90 seconds') INTO v_online
  FROM game_saves WHERE id = p_character_id;
  RETURN COALESCE(v_online, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Busca jogadores ja retornando o status online calculado no servidor
CREATE OR REPLACE FUNCTION search_players_online(p_query TEXT)
RETURNS TABLE (
  id UUID,
  player_name TEXT,
  user_id UUID,
  is_online BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT gs.id, gs.player_name, gs.user_id,
         (COALESCE(gs.last_seen, gs.updated_at) > NOW() - INTERVAL '90 seconds') AS is_online
  FROM game_saves gs
  WHERE gs.player_name ILIKE '%' || p_query || '%'
  ORDER BY gs.updated_at DESC
  LIMIT 10;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;
