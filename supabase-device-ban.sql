-- ============================================================
-- PokeFury - Banimento por dispositivo (device ban)
-- Rodar inteiro no Supabase SQL Editor (é idempotente).
--
--  1. Tabelas: device_registry (dispositivos vistos por usuário)
--              banned_devices  (dispositivos banidos)
--  2. RPCs:
--     - register_device(p_device_hash)        [client]
--     - get_my_ban_status(p_device_hash)      [client] -> conta OU dispositivo
--     - ban_device(p_device_hash, p_reason)   [admin]
--     - unban_device(p_device_hash)           [admin]
--     - get_banned_devices()                  [admin]
--  3. set_player_banned reescrito: ao banir uma conta, também
--     bane todos os dispositivos registrados dela.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Tabelas (RLS SEM policies => só SECURITY DEFINER acessa)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS device_registry (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_hash text NOT NULL,
  last_seen timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, device_hash)
);
ALTER TABLE device_registry ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS banned_devices (
  device_hash text PRIMARY KEY,
  reason text,
  banned_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE banned_devices ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------
-- Helper: dispositivo está banido?
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION device_is_banned(p_device_hash text)
RETURNS boolean AS $$
  SELECT EXISTS (SELECT 1 FROM banned_devices WHERE device_hash = p_device_hash);
$$ LANGUAGE sql SECURITY DEFINER;

-- ------------------------------------------------------------
-- register_device: client reporta o dispositivo em que está logado
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION register_device(p_device_hash text)
RETURNS jsonb AS $$
DECLARE
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RETURN jsonb_build_object('error','Not authenticated'); END IF;
  IF p_device_hash IS NULL OR p_device_hash = '' THEN
    RETURN jsonb_build_object('success', true);
  END IF;
  INSERT INTO device_registry(user_id, device_hash, last_seen)
  VALUES (v_user_id, p_device_hash, now())
  ON CONFLICT (user_id, device_hash) DO UPDATE SET last_seen = now();
  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ------------------------------------------------------------
-- get_my_ban_status: reescrito para checar conta E dispositivo
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_my_ban_status(p_device_hash text DEFAULT NULL)
RETURNS jsonb AS $$
DECLARE
  v_user_id uuid;
  v_banned boolean;
  v_device_banned boolean;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RETURN jsonb_build_object('error','Not authenticated'); END IF;
  SELECT is_banned INTO v_banned FROM profiles WHERE id = v_user_id;
  v_device_banned := (p_device_hash IS NOT NULL AND p_device_hash <> '')
                     AND device_is_banned(p_device_hash);
  RETURN jsonb_build_object(
    'success', true,
    'is_banned', COALESCE(v_banned, false),
    'device_banned', COALESCE(v_device_banned, false)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ------------------------------------------------------------
-- set_player_banned: reescrito (admin) - ao banir, bane também
-- os dispositivos registrados do jogador.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_player_banned(p_user_id uuid, p_banned boolean) RETURNS jsonb AS $$
DECLARE
  v_user_id uuid;
  v_admin boolean;
  v_username text;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RETURN jsonb_build_object('error','Not authenticated'); END IF;
  SELECT is_admin INTO v_admin FROM profiles WHERE id = v_user_id;
  IF COALESCE(v_admin, false) IS DISTINCT FROM true THEN
    RETURN jsonb_build_object('error','Not authorized');
  END IF;

  UPDATE profiles SET is_banned = COALESCE(p_banned, true) WHERE id = p_user_id;

  IF COALESCE(p_banned, true) THEN
    -- Bane todos os dispositivos registrados da conta
    SELECT username INTO v_username FROM profiles WHERE id = p_user_id;
    INSERT INTO banned_devices(device_hash, reason, banned_by)
    SELECT dr.device_hash,
           'ban_account:' || COALESCE(v_username, p_user_id::text),
           v_user_id
    FROM device_registry dr
    WHERE dr.user_id = p_user_id
    ON CONFLICT (device_hash) DO UPDATE SET
      reason = EXCLUDED.reason,
      banned_by = EXCLUDED.banned_by;
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ------------------------------------------------------------
-- ban_device (admin): bane um dispositivo específico
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION ban_device(p_device_hash text, p_reason text DEFAULT NULL)
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
  IF p_device_hash IS NULL OR p_device_hash = '' THEN
    RETURN jsonb_build_object('error','Invalid device');
  END IF;
  INSERT INTO banned_devices(device_hash, reason, banned_by)
  VALUES (p_device_hash, COALESCE(p_reason, 'manual'), v_user_id)
  ON CONFLICT (device_hash) DO UPDATE SET reason = EXCLUDED.reason, banned_by = EXCLUDED.banned_by;
  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ------------------------------------------------------------
-- unban_device (admin): remove o dispositivo da lista de banidos
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION unban_device(p_device_hash text)
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
  DELETE FROM banned_devices WHERE device_hash = p_device_hash;
  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ------------------------------------------------------------
-- get_banned_devices (admin): lista dispositivos banidos
-- com os usuários que os utilizaram recentemente.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_banned_devices()
RETURNS jsonb AS $$
DECLARE
  v_user_id uuid;
  v_admin boolean;
  v_devices jsonb;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RETURN jsonb_build_object('error','Not authenticated'); END IF;
  SELECT is_admin INTO v_admin FROM profiles WHERE id = v_user_id;
  IF COALESCE(v_admin, false) IS DISTINCT FROM true THEN
    RETURN jsonb_build_object('error','Not authorized');
  END IF;

  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) INTO v_devices FROM (
    SELECT bd.device_hash, bd.reason, bd.created_at,
           COALESCE(jsonb_agg(DISTINCT p.username) FILTER (WHERE p.username IS NOT NULL), '[]'::jsonb) AS users
    FROM banned_devices bd
    LEFT JOIN device_registry dr ON dr.device_hash = bd.device_hash
    LEFT JOIN profiles p ON p.id = dr.user_id
    GROUP BY bd.device_hash, bd.reason, bd.created_at
    ORDER BY bd.created_at DESC
  ) t;

  RETURN jsonb_build_object('success', true, 'devices', v_devices);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

SELECT 'Device ban system installed' AS status;
