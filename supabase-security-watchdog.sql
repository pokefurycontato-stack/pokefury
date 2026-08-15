-- ============================================================
-- PokeFury - Camada de segurança (watchdog + validação servidor)
-- Rodar inteiro no Supabase SQL Editor (é idempotente).
--
-- Cobre:
--  1. Tabela security_events (log de tamper/erros/rate-limit)
--  2. Tabelas de auditoria/rate (rate_events, exp_grants)
--  3. is_banned em profiles + helper is_user_banned()
--  4. RPCs: log_security_event / get_security_events / set_player_banned
--  5. Re-grava as RPCs de progresso com ban-guard + caps + rate-limit
-- ============================================================

-- ------------------------------------------------------------
-- 1. Tabelas (todas com RLS SEM policies => só funções SECURITY DEFINER acessam)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS security_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  character_id uuid,
  player_name text,
  event_type text NOT NULL,          -- function_tamper | client_error | server_reject | rate_limit | anomaly
  function_name text,
  detail jsonb,
  url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rate_events (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL,
  bucket text NOT NULL,              -- battle_reward | security_log
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS exp_grants (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL,
  amount int NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE security_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE exp_grants ENABLE ROW LEVEL SECURITY;

-- Nenhuma policy criada de proposito: acesso direto negado a todos.
-- Somente as funcoes abaixo (SECURITY DEFINER) conseguem ler/escrever.

-- ------------------------------------------------------------
-- 2. is_banned em profiles + helper
-- ------------------------------------------------------------
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_banned boolean DEFAULT false;

CREATE OR REPLACE FUNCTION is_user_banned() RETURNS boolean AS $$
  SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_banned = true);
$$ LANGUAGE sql SECURITY DEFINER;

-- ------------------------------------------------------------
-- 3. log_security_event (rate limit 30/min/jogador; anti-spoof de character)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION log_security_event(
  p_character_id uuid,
  p_event_type text,
  p_function_name text DEFAULT NULL,
  p_detail jsonb DEFAULT '{}'::jsonb,
  p_url text DEFAULT NULL
) RETURNS jsonb AS $$
DECLARE
  v_user_id uuid;
  v_owner uuid;
  v_player_name text;
  v_count int;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RETURN jsonb_build_object('error','Not authenticated'); END IF;

  IF p_character_id IS NOT NULL THEN
    SELECT user_id INTO v_owner FROM game_saves WHERE id = p_character_id;
    IF v_owner IS DISTINCT FROM v_user_id THEN
      RETURN jsonb_build_object('error','Not authorized');
    END IF;
    SELECT player_name INTO v_player_name FROM game_saves WHERE id = p_character_id;
  END IF;

  SELECT COUNT(*) INTO v_count FROM rate_events
    WHERE user_id = v_user_id AND bucket = 'security_log' AND created_at > now() - interval '1 minute';
  IF v_count >= 30 THEN
    RETURN jsonb_build_object('success', true, 'dropped', 'rate_limit');
  END IF;

  INSERT INTO rate_events(user_id, bucket) VALUES (v_user_id, 'security_log');
  INSERT INTO security_events(user_id, character_id, player_name, event_type, function_name, detail, url)
  VALUES (v_user_id, p_character_id, v_player_name, p_event_type, p_function_name,
          COALESCE(p_detail, '{}'::jsonb), p_url);

  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ------------------------------------------------------------
-- 4. get_security_events (somente admin)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_security_events(p_limit int DEFAULT 100) RETURNS jsonb AS $$
DECLARE
  v_user_id uuid;
  v_admin boolean;
  v_events jsonb;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RETURN jsonb_build_object('error','Not authenticated'); END IF;
  SELECT is_admin INTO v_admin FROM profiles WHERE id = v_user_id;
  IF COALESCE(v_admin, false) IS DISTINCT FROM true THEN
    RETURN jsonb_build_object('error','Not authorized');
  END IF;

  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) INTO v_events FROM (
    SELECT se.id, se.user_id, p.username, p.is_banned, se.character_id, se.player_name,
           se.event_type, se.function_name, se.detail, se.url, se.created_at
    FROM security_events se
    LEFT JOIN profiles p ON p.id = se.user_id
    ORDER BY se.created_at DESC
    LIMIT LEAST(GREATEST(COALESCE(p_limit, 100), 1), 500)
  ) t;

  RETURN jsonb_build_object('success', true, 'events', v_events);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ------------------------------------------------------------
-- 5. set_player_banned (somente admin)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_player_banned(p_user_id uuid, p_banned boolean) RETURNS jsonb AS $$
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
  UPDATE profiles SET is_banned = COALESCE(p_banned, true) WHERE id = p_user_id;
  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ------------------------------------------------------------
-- 5b. get_my_ban_status (client consulta periodicamente)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_my_ban_status() RETURNS jsonb AS $$
DECLARE
  v_user_id uuid;
  v_banned boolean;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RETURN jsonb_build_object('error','Not authenticated'); END IF;
  SELECT is_banned INTO v_banned FROM profiles WHERE id = v_user_id;
  RETURN jsonb_build_object('success', true, 'is_banned', COALESCE(v_banned, false));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 6. Re-grava as RPCs de progresso com ban-guard + caps
-- ============================================================

-- ------------------------------------------------------------
-- 6a. secure_save_team (adiciona ban-guard)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION secure_save_team(p_character_id UUID, p_team JSONB) RETURNS JSONB AS $$
DECLARE
  v_user_id UUID; v_row RECORD; v_el JSONB; v_pid UUID;
  v_poke RECORD; v_max_hp INT; v_power INT; v_legal_moves JSONB;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('error','Not authenticated'); END IF;
  IF is_user_banned() THEN RETURN jsonb_build_object('error','Account banned'); END IF;
  SELECT user_id INTO v_user_id FROM game_saves WHERE id = p_character_id;
  IF v_user_id IS DISTINCT FROM auth.uid() THEN RETURN jsonb_build_object('error','Not authorized'); END IF;

  FOR v_el IN SELECT * FROM jsonb_array_elements(COALESCE(p_team, '[]'::jsonb)) LOOP
    v_pid := (v_el->>'id')::UUID;
    CONTINUE WHEN v_pid IS NULL;

    SELECT * INTO v_row FROM pokemon_team WHERE id = v_pid AND character_id = p_character_id;
    CONTINUE WHEN NOT FOUND;

    SELECT * INTO v_poke FROM pokemon WHERE id = v_row.pokemon_id;
    IF FOUND THEN
      SELECT stat_hp INTO v_max_hp FROM compute_stats(v_poke.hp, v_poke.attack, v_poke.defense, v_poke.sp_atk, v_poke.sp_def, v_poke.speed,
        v_row.level, v_row.iv_hp, v_row.iv_attack, v_row.iv_defense, v_row.iv_sp_atk, v_row.iv_sp_def, v_row.iv_speed,
        v_row.ev_hp, v_row.ev_attack, v_row.ev_defense, v_row.ev_sp_atk, v_row.ev_sp_def, v_row.ev_speed, v_row.nature);
      v_power := compute_power(v_poke.hp, v_poke.attack, v_poke.defense, v_poke.sp_atk, v_poke.sp_def, v_poke.speed,
        v_row.level, v_row.iv_hp, v_row.iv_attack, v_row.iv_defense, v_row.iv_sp_atk, v_row.iv_sp_def, v_row.iv_speed,
        v_row.ev_hp, v_row.ev_attack, v_row.ev_defense, v_row.ev_sp_atk, v_row.ev_sp_def, v_row.ev_speed, v_row.nature);
    ELSE
      v_max_hp := COALESCE(v_row.current_hp, 1);
      v_power := COALESCE(v_row.power, 0);
    END IF;

    -- Valida movimentos: so aceita moves que o pokemon pode aprender (pokemon_moves_v2)
    SELECT COALESCE(jsonb_agg(jsonb_build_object('id', (cm.move_id)::INT, 'pp', LEAST((cm.pp)::INT, 40))), '[]'::jsonb)
    INTO v_legal_moves
    FROM (
      SELECT elem->>'id' AS move_id, COALESCE(elem->>'pp', '0') AS pp
      FROM jsonb_array_elements(COALESCE((v_el->>'moves')::jsonb, '[]'::jsonb)) elem
    ) cm
    WHERE EXISTS (
      SELECT 1 FROM pokemon_moves_v2 pmv
      WHERE pmv.move_id = (cm.move_id)::INT
        AND pmv.pokemon_id IN (v_row.pokemon_id, COALESCE(v_poke.base_pokemon_id, v_row.pokemon_id))
    );

    UPDATE pokemon_team SET
      current_hp = LEAST(v_max_hp, COALESCE((v_el->>'current_hp')::INT, v_row.current_hp)),
      status_effect = COALESCE(v_el->>'status_effect', v_row.status_effect),
      moves = v_legal_moves,
      held_item_id = COALESCE((v_el->>'held_item_id')::INT, v_row.held_item_id),
      slot = COALESCE((v_el->>'slot')::INT, v_row.slot),
      power = v_power
    WHERE id = v_pid;
  END LOOP;

  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ------------------------------------------------------------
-- 6b. secure_capture_pokemon (adiciona ban-guard)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION secure_capture_pokemon(
  p_character_id UUID, p_pokemon_id INT, p_level INT, p_is_shiny BOOLEAN, p_moves JSONB
) RETURNS JSONB AS $$
DECLARE
  v_user_id UUID; v_team_count INT; v_poke RECORD; v_slot INT;
  v_iv_hp INT; v_iv_attack INT; v_iv_defense INT; v_iv_sp_atk INT; v_iv_sp_def INT; v_iv_speed INT;
  v_nature TEXT; v_natures TEXT[] := ARRAY['hardy','lonely','brave','adamant','naughty','bold','docile','relaxed','impish','lax','timid','hasty','serious','jolly','naive','modest','mild','quiet','bashful','rash','calm','gentle','sassy','careful','quirky'];
  v_stats RECORD; v_power INT; v_new_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('error','Not authenticated'); END IF;
  IF is_user_banned() THEN RETURN jsonb_build_object('error','Account banned'); END IF;
  SELECT user_id INTO v_user_id FROM game_saves WHERE id = p_character_id;
  IF v_user_id IS DISTINCT FROM auth.uid() THEN RETURN jsonb_build_object('error','Not authorized'); END IF;
  IF p_level < 1 OR p_level > 100 THEN RETURN jsonb_build_object('error','Invalid level'); END IF;

  SELECT * INTO v_poke FROM pokemon WHERE id = p_pokemon_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','Pokemon not found'); END IF;

  SELECT COUNT(*) INTO v_team_count FROM pokemon_team WHERE character_id = p_character_id;
  IF v_team_count >= 6 THEN RETURN jsonb_build_object('error','Team full'); END IF;

  v_iv_hp := FLOOR(random()*32)::INT;
  v_iv_attack := FLOOR(random()*32)::INT;
  v_iv_defense := FLOOR(random()*32)::INT;
  v_iv_sp_atk := FLOOR(random()*32)::INT;
  v_iv_sp_def := FLOOR(random()*32)::INT;
  v_iv_speed := FLOOR(random()*32)::INT;
  v_nature := v_natures[1 + FLOOR(random()*25)::INT];

  SELECT * INTO v_stats FROM compute_stats(v_poke.hp, v_poke.attack, v_poke.defense, v_poke.sp_atk, v_poke.sp_def, v_poke.speed,
    p_level, v_iv_hp, v_iv_attack, v_iv_defense, v_iv_sp_atk, v_iv_sp_def, v_iv_speed,
    0, 0, 0, 0, 0, 0, v_nature);

  v_power := compute_power(v_poke.hp, v_poke.attack, v_poke.defense, v_poke.sp_atk, v_poke.sp_def, v_poke.speed,
    p_level, v_iv_hp, v_iv_attack, v_iv_defense, v_iv_sp_atk, v_iv_sp_def, v_iv_speed,
    0, 0, 0, 0, 0, 0, v_nature);

  v_slot := v_team_count + 1;
  INSERT INTO pokemon_team (
    user_id, character_id, pokemon_id, species, nickname, level, current_hp, experience, moves, is_active, slot,
    iv_hp, iv_attack, iv_defense, iv_sp_atk, iv_sp_def, iv_speed,
    ev_hp, ev_attack, ev_defense, ev_sp_atk, ev_sp_def, ev_speed,
    nature, happiness, is_shiny, is_mega, held_item_id, power
  ) VALUES (
    auth.uid(), p_character_id, p_pokemon_id, v_poke.name, v_poke.name, p_level, v_stats.stat_hp, 0, COALESCE(p_moves, '[]'::jsonb), false, v_slot,
    v_iv_hp, v_iv_attack, v_iv_defense, v_iv_sp_atk, v_iv_sp_def, v_iv_speed,
    0, 0, 0, 0, 0, 0,
    v_nature, 70, p_is_shiny, false, null, v_power
  ) RETURNING id INTO v_new_id;

  RETURN jsonb_build_object(
    'success', true, 'id', v_new_id, 'level', p_level,
    'iv_hp', v_iv_hp, 'iv_attack', v_iv_attack, 'iv_defense', v_iv_defense,
    'iv_sp_atk', v_iv_sp_atk, 'iv_sp_def', v_iv_sp_def, 'iv_speed', v_iv_speed,
    'nature', v_nature, 'power', v_power,
    'stats_hp', v_stats.stat_hp, 'stats_attack', v_stats.stat_attack, 'stats_defense', v_stats.stat_defense,
    'stats_sp_atk', v_stats.stat_sp_atk, 'stats_sp_def', v_stats.stat_sp_def, 'stats_speed', v_stats.stat_speed
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ------------------------------------------------------------
-- 6c. secure_grant_exp (ban-guard + cap por chamada + teto diario)
-- cap por chamada: 50.000 (uma batalha legit chega a ~10-20k com boosts)
-- teto diario: 5.000.000 em 24h
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION secure_grant_exp(p_character_id UUID, p_pokemon_team_id UUID, p_amount INT) RETURNS JSONB AS $$
DECLARE
  v_row RECORD; v_poke RECORD; v_new_exp INT; v_level INT; v_old_max INT; v_new_stats RECORD; v_power INT;
  v_capped INT; v_today_exp BIGINT;
  v_max_single INT := 50000; v_daily_cap BIGINT := 5000000;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('error','Not authenticated'); END IF;
  IF is_user_banned() THEN RETURN jsonb_build_object('error','Account banned'); END IF;
  SELECT * INTO v_row FROM pokemon_team WHERE id = p_pokemon_team_id AND character_id = p_character_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','Not authorized'); END IF;

  v_capped := LEAST(GREATEST(0, COALESCE(p_amount, 0)), v_max_single);

  SELECT COALESCE(SUM(amount), 0) INTO v_today_exp FROM exp_grants
    WHERE user_id = auth.uid() AND created_at > now() - interval '24 hours';
  IF v_today_exp + v_capped > v_daily_cap THEN
    PERFORM log_security_event(p_character_id, 'rate_limit', 'secure_grant_exp',
      jsonb_build_object('reason','daily cap exceeded','today_exp', v_today_exp, 'attempted', v_capped), null);
    RETURN jsonb_build_object('error','Daily exp cap reached');
  END IF;

  v_level := v_row.level;
  v_new_exp := COALESCE(v_row.experience, 0) + v_capped;
  WHILE v_level < 100 AND v_new_exp >= exp_for_level(v_level + 1) LOOP
    v_new_exp := v_new_exp - exp_for_level(v_level + 1);
    v_level := v_level + 1;
  END LOOP;
  IF v_level >= 100 THEN v_new_exp := 0; END IF;

  SELECT * INTO v_poke FROM pokemon WHERE id = v_row.pokemon_id;
  SELECT stat_hp INTO v_old_max FROM compute_stats(v_poke.hp, v_poke.attack, v_poke.defense, v_poke.sp_atk, v_poke.sp_def, v_poke.speed,
    v_row.level, v_row.iv_hp, v_row.iv_attack, v_row.iv_defense, v_row.iv_sp_atk, v_row.iv_sp_def, v_row.iv_speed,
    v_row.ev_hp, v_row.ev_attack, v_row.ev_defense, v_row.ev_sp_atk, v_row.ev_sp_def, v_row.ev_speed, v_row.nature);
  SELECT * INTO v_new_stats FROM compute_stats(v_poke.hp, v_poke.attack, v_poke.defense, v_poke.sp_atk, v_poke.sp_def, v_poke.speed,
    v_level, v_row.iv_hp, v_row.iv_attack, v_row.iv_defense, v_row.iv_sp_atk, v_row.iv_sp_def, v_row.iv_speed,
    v_row.ev_hp, v_row.ev_attack, v_row.ev_defense, v_row.ev_sp_atk, v_row.ev_sp_def, v_row.ev_speed, v_row.nature);
  v_power := compute_power(v_poke.hp, v_poke.attack, v_poke.defense, v_poke.sp_atk, v_poke.sp_def, v_poke.speed,
    v_level, v_row.iv_hp, v_row.iv_attack, v_row.iv_defense, v_row.iv_sp_atk, v_row.iv_sp_def, v_row.iv_speed,
    v_row.ev_hp, v_row.ev_attack, v_row.ev_defense, v_row.ev_sp_atk, v_row.ev_sp_def, v_row.ev_speed, v_row.nature);

  UPDATE pokemon_team SET
    level = v_level, experience = v_new_exp,
    current_hp = LEAST(v_new_stats.stat_hp, COALESCE(v_row.current_hp,0) + GREATEST(0, v_new_stats.stat_hp - v_old_max)),
    power = v_power
  WHERE id = p_pokemon_team_id;

  INSERT INTO exp_grants(user_id, amount) VALUES (auth.uid(), v_capped);

  RETURN jsonb_build_object('success', true, 'level', v_level, 'experience', v_new_exp,
    'stats_hp', v_new_stats.stat_hp, 'stats_attack', v_new_stats.stat_attack, 'stats_defense', v_new_stats.stat_defense,
    'stats_sp_atk', v_new_stats.stat_sp_atk, 'stats_sp_def', v_new_stats.stat_sp_def, 'stats_speed', v_new_stats.stat_speed);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ------------------------------------------------------------
-- 6d. calculate_battle_reward (ban-guard + rate-limit 60/min)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION calculate_battle_reward(
  p_character_id UUID,
  p_enemy_pokemon_id INTEGER,
  p_enemy_level INTEGER,
  p_win_streak INTEGER DEFAULT 0,
  p_amulet_coin BOOLEAN DEFAULT false
) RETURNS JSONB AS $$
DECLARE
  v_owner_user_id UUID;
  v_bst INTEGER;
  v_rarity_mult NUMERIC;
  v_streak_mult NUMERIC;
  v_silver INTEGER;
  v_base_exp INTEGER;
  v_is_starter BOOLEAN;
  v_requests INT;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;
  IF is_user_banned() THEN
    RETURN jsonb_build_object('error', 'Account banned');
  END IF;

  SELECT gs.user_id INTO v_owner_user_id FROM game_saves gs WHERE gs.id = p_character_id;
  IF NOT FOUND OR v_owner_user_id != auth.uid() THEN
    RETURN jsonb_build_object('error', 'Not authorized');
  END IF;

  SELECT COUNT(*) INTO v_requests FROM rate_events
    WHERE user_id = auth.uid() AND bucket = 'battle_reward' AND created_at > now() - interval '1 minute';
  IF v_requests >= 60 THEN
    PERFORM log_security_event(p_character_id, 'rate_limit', 'calculate_battle_reward',
      jsonb_build_object('reason','too many reward calls','requests_1min', v_requests), null);
    RETURN jsonb_build_object('error', 'Rate limited');
  END IF;
  INSERT INTO rate_events(user_id, bucket) VALUES (auth.uid(), 'battle_reward');

  -- Calculate BST from pokemon table
  SELECT COALESCE(hp, 0) + COALESCE(attack, 0) + COALESCE(defense, 0) +
         COALESCE(sp_atk, 0) + COALESCE(sp_def, 0) + COALESCE(speed, 0)
  INTO v_bst FROM pokemon WHERE id = p_enemy_pokemon_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Pokemon not found');
  END IF;

  -- Silver calculation (mirrors client logic)
  v_silver := (p_enemy_level * 2) + FLOOR(RANDOM() * (p_enemy_level + 1));

  IF v_bst >= 600 THEN v_rarity_mult := 2.5;
  ELSIF v_bst >= 500 THEN v_rarity_mult := 1.5;
  ELSIF v_bst >= 400 THEN v_rarity_mult := 1.2;
  ELSE v_rarity_mult := 1.0;
  END IF;

  -- Check if starter
  v_is_starter := p_enemy_pokemon_id IN (1,4,7,25,152,155,158,252,255,258,387,390,393,495,498,501,650,653,656,722,725,728,810,813,816,906,909,912);
  IF v_is_starter THEN v_rarity_mult := 0.5; END IF;

  v_streak_mult := 1.0;
  IF p_win_streak >= 5 THEN v_streak_mult := 1.2; END IF;

  v_silver := FLOOR(v_silver * v_rarity_mult * v_streak_mult);
  IF v_silver < 1 THEN v_silver := 1; END IF;

  -- Amulet Coin: dobra a prata
  IF p_amulet_coin THEN v_silver := v_silver * 2; END IF;

  -- Base EXP calculation
  v_base_exp := FLOOR((p_enemy_level * 15) / 9) * 3;

  -- Issue silver
  PERFORM add_currency(p_character_id, 'silver', v_silver, 'reward', 'Battle vs pokemon #' || p_enemy_pokemon_id);

  -- Registrar abate + verificar títulos (se existir a função record_wild_kill)
  DECLARE
    v_titles JSONB DEFAULT '[]'::jsonb;
  BEGIN
    SELECT COALESCE(kill_res->'awarded', '[]'::jsonb) INTO v_titles
    FROM record_wild_kill(p_character_id) AS kill_res;
    RETURN jsonb_build_object(
      'success', true,
      'silver_earned', v_silver,
      'base_exp', v_base_exp,
      'enemy_id', p_enemy_pokemon_id,
      'enemy_level', p_enemy_level,
      'awarded_titles', v_titles
    );
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
