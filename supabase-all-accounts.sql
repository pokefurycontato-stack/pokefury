-- ============================================================
-- PokeFury - TODAS as contas (admin)
-- Rodar inteiro no Supabase SQL Editor (é idempotente).
--
-- get_all_accounts: lista TODAS as contas de auth.users com:
--   - player_name (último personagem que logou na conta)
--   - email da conta
--   - is_online (last_seen nos últimos 10 min)
--   - connected_seconds (tempo conectado, quando online)
--   - idle_seconds (tempo de inatividade; p/ offline = tempo
--     desde a última vez que a conta conectou no jogo)
-- ============================================================

CREATE OR REPLACE FUNCTION get_all_accounts()
RETURNS jsonb AS $$
DECLARE
  v_user_id uuid;
  v_admin boolean;
  v_accounts jsonb;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RETURN jsonb_build_object('error','Not authenticated'); END IF;
  SELECT is_admin INTO v_admin FROM profiles WHERE id = v_user_id;
  IF COALESCE(v_admin, false) IS DISTINCT FROM true THEN
    RETURN jsonb_build_object('error','Not authorized');
  END IF;

  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) INTO v_accounts FROM (
    SELECT u.id AS user_id,
           COALESCE(p.display_email, u.email, '') AS email,
           COALESCE(gs.player_name, '') AS player_name,
           gs.connected_at,
           gs.last_seen,
           COALESCE(gs.last_seen > NOW() - INTERVAL '10 minutes', false) AS is_online,
           CASE WHEN COALESCE(gs.last_seen > NOW() - INTERVAL '10 minutes', false)
                THEN (EXTRACT(EPOCH FROM (NOW() - COALESCE(gs.connected_at, gs.last_seen))))::int END AS connected_seconds,
           (EXTRACT(EPOCH FROM (NOW() - COALESCE(gs.last_seen, u.created_at))))::int AS idle_seconds
    FROM auth.users u
    LEFT JOIN profiles p ON p.id = u.id
    LEFT JOIN LATERAL (
      SELECT gs.player_name, gs.connected_at, gs.last_seen
      FROM game_saves gs
      WHERE gs.user_id = u.id
      ORDER BY COALESCE(gs.last_seen, gs.updated_at) DESC NULLS LAST
      LIMIT 1
    ) gs ON true
  ) t;

  RETURN jsonb_build_object('success', true, 'players', v_accounts);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

SELECT 'get_all_accounts installed' AS status;
