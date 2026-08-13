-- ============================================================
-- PVP CURRENT TEAM: RPC que le o time atual de qualquer personagem
-- (contorna o RLS, que bloqueia ler o time de OUTRO jogador)
-- ============================================================

CREATE OR REPLACE FUNCTION get_character_team(p_character_id UUID)
RETURNS SETOF pokemon_team AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM pokemon_team
  WHERE character_id = p_character_id
  ORDER BY slot ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
