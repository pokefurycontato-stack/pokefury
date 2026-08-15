-- ============================================================
-- PokeFury - Contas conectadas + logout forçado (admin)
-- Rodar inteiro no Supabase SQL Editor (é idempotente).
--
--  1. Colunas em game_saves: connected_at (início da sessão)
--  2. Coluna em profiles: force_logout_at (marca de logout)
--  3. register_connected  (client) - marca início da sessão
--  4. get_online_players  (admin) - lista conectados + inatividade
--  5. force_logout        (admin) - revoga sessões + marca logout
--  6. get_my_ban_status   reescrito p/ incluir force_logout_at
-- ============================================================

ALTER TABLE game_saves ADD COLUMN IF NOT EXISTS connected_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS force_logout_at TIMESTAMPTZ;

-- ------------------------------------------------------------
-- register_connected: client chama ao carregar o personagem.
-- Marca connected_at se for uma nova sessão e atualiza last_seen.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION register_connected(p_character_id UUID)
RETURNS jsonb AS $$
DECLARE
  v_owner UUID;
  v_new_session boolean;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('error','Not authenticated'); END IF;
  SELECT user_id INTO v_owner FROM game_saves WHERE id = p_character_id;
  IF v_owner IS DISTINCT FROM auth.uid() THEN
    RETURN jsonb_build_object('error','Not authorized');
  END IF;

  SELECT (connected_at IS NULL OR connected_at < NOW() - INTERVAL '30 minutes')
    INTO v_new_session
  FROM game_saves WHERE id = p_character_id;

  UPDATE game_saves SET
    connected_at = CASE WHEN v_new_session THEN NOW() ELSE connected_at END,
    last_seen = NOW()
  WHERE id = p_character_id;

  RETURN jsonb_build_object('success', true, 'new_session', COALESCE(v_new_session, true));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ------------------------------------------------------------
-- get_online_players (admin): quem está conectado.
-- online = last_seen nos últimos 10 minutos.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_online_players()
RETURNS jsonb AS $$
DECLARE
  v_user_id uuid;
  v_admin boolean;
  v_players jsonb;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RETURN jsonb_build_object('error','Not authenticated'); END IF;
  SELECT is_admin INTO v_admin FROM profiles WHERE id = v_user_id;
  IF COALESCE(v_admin, false) IS DISTINCT FROM true THEN
    RETURN jsonb_build_object('error','Not authorized');
  END IF;

  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) INTO v_players FROM (
    SELECT gs.id AS character_id,
           gs.user_id,
           gs.player_name,
           COALESCE(p.display_email, '') AS email,
           gs.connected_at,
           gs.last_seen,
           (EXTRACT(EPOCH FROM (NOW() - gs.last_seen)))::int AS idle_seconds,
           (EXTRACT(EPOCH FROM (NOW() - gs.connected_at)))::int AS connected_seconds
    FROM game_saves gs
    LEFT JOIN profiles p ON p.id = gs.user_id
    WHERE gs.last_seen > NOW() - INTERVAL '10 minutes'
    ORDER BY gs.last_seen DESC
  ) t;

  RETURN jsonb_build_object('success', true, 'players', v_players);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ------------------------------------------------------------
-- force_logout (admin): revoga TODAS as sessões do usuário no
-- Supabase Auth e marca force_logout_at para o client deslogar.
-- Não é banimento: a conta continua válida.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION force_logout(p_user_id uuid)
RETURNS jsonb AS $$
DECLARE
  v_user_id uuid;
  v_admin boolean;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RETURN jsonb_build_object('error','Not authenticated'); END IF;
  SELECT is_admin INTO v_admin FROM profiles WHERE id = v_user_id;
  IF COALESCE(v_admin, false) IS DISTINCT FROM true THEN
    RETURN jsonb_build_object('error','Not authorized');
  END IF;

  -- Revoga o refresh token/sessões ativas (força re-autenticação)
  DELETE FROM auth.sessions WHERE user_id = p_user_id;
  DELETE FROM auth.refresh_tokens WHERE user_id = p_user_id;

  -- Marca para o client fazer logout local imediato
  UPDATE profiles SET force_logout_at = NOW() WHERE id = p_user_id;

  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ------------------------------------------------------------
-- get_my_ban_status: reescrito para incluir force_logout_at
-- (o client usa para deslogar quando o admin desconecta)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_my_ban_status(p_device_hash text DEFAULT NULL)
RETURNS jsonb AS $$
DECLARE
  v_user_id uuid;
  v_banned boolean;
  v_device_banned boolean;
  v_force_logout_at timestamptz;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RETURN jsonb_build_object('error','Not authenticated'); END IF;
  SELECT is_banned INTO v_banned FROM profiles WHERE id = v_user_id;
  SELECT force_logout_at INTO v_force_logout_at FROM profiles WHERE id = v_user_id;
  v_device_banned := (p_device_hash IS NOT NULL AND p_device_hash <> '')
                     AND device_is_banned(p_device_hash);
  RETURN jsonb_build_object(
    'success', true,
    'is_banned', COALESCE(v_banned, false),
    'device_banned', COALESCE(v_device_banned, false),
    'force_logout_at', v_force_logout_at
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

SELECT 'Online players + force logout installed' AS status;
