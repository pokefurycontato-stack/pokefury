-- ============================================================
-- BLOQUEIO TOTAL DE MANIPULACAO PELO CLIENT
-- Toda escrita em pokemon_team / trainer_level passa por RPC SECURITY DEFINER
-- ============================================================

-- ------------------------------------------------------------
-- 1. BLOQUEIA escrita direta em pokemon_team (so leitura do proprio time)
-- ------------------------------------------------------------
ALTER TABLE pokemon_team ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pokemonteam_select" ON pokemon_team;
DROP POLICY IF EXISTS "pokemonteam_insert" ON pokemon_team;
DROP POLICY IF EXISTS "pokemonteam_update" ON pokemon_team;
DROP POLICY IF EXISTS "pokemonteam_delete" ON pokemon_team;
DROP POLICY IF EXISTS "pokemonteam_block_insert" ON pokemon_team;
DROP POLICY IF EXISTS "pokemonteam_block_update" ON pokemon_team;
DROP POLICY IF EXISTS "pokemonteam_block_delete" ON pokemon_team;

CREATE POLICY "pokemonteam_select" ON pokemon_team
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "pokemonteam_block_insert" ON pokemon_team FOR INSERT WITH CHECK (false);
CREATE POLICY "pokemonteam_block_update" ON pokemon_team FOR UPDATE USING (false);
CREATE POLICY "pokemonteam_block_delete" ON pokemon_team FOR DELETE USING (false);

-- ------------------------------------------------------------
-- 2. HELPERS (server-side): stats e poder
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION exp_for_level(p_level INT) RETURNS INT AS $$
BEGIN
  RETURN FLOOR(POW(p_level, 3) * 0.8)::INT;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION trainer_exp_for_level(p_level INT) RETURNS INT AS $$
BEGIN
  IF p_level >= 91 THEN RETURN 100000; END IF;
  IF p_level >= 81 THEN RETURN 40000; END IF;
  IF p_level >= 71 THEN RETURN 25000; END IF;
  IF p_level >= 61 THEN RETURN 15000; END IF;
  IF p_level >= 51 THEN RETURN 10000; END IF;
  IF p_level >= 41 THEN RETURN 5000; END IF;
  IF p_level >= 31 THEN RETURN 2000; END IF;
  IF p_level >= 21 THEN RETURN 1000; END IF;
  IF p_level >= 11 THEN RETURN 400; END IF;
  IF p_level >= 7 THEN RETURN 200; END IF;
  IF p_level >= 4 THEN RETURN 100; END IF;
  RETURN 50;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION compute_stats(
  p_hp INT, p_attack INT, p_defense INT, p_sp_atk INT, p_sp_def INT, p_speed INT,
  p_level INT, p_iv_hp INT, p_iv_attack INT, p_iv_defense INT, p_iv_sp_atk INT, p_iv_sp_def INT, p_iv_speed INT,
  p_ev_hp INT, p_ev_attack INT, p_ev_defense INT, p_ev_sp_atk INT, p_ev_sp_def INT, p_ev_speed INT,
  p_nature TEXT,
  OUT stat_hp INT, OUT stat_attack INT, OUT stat_defense INT, OUT stat_sp_atk INT, OUT stat_sp_def INT, OUT stat_speed INT
) AS $$
DECLARE
  nm_attack NUMERIC := 1.0; nm_defense NUMERIC := 1.0; nm_sp_atk NUMERIC := 1.0; nm_sp_def NUMERIC := 1.0; nm_speed NUMERIC := 1.0;
BEGIN
  IF p_nature IN ('lonely','brave','adamant','naughty') THEN nm_attack := 1.1; END IF;
  IF p_nature IN ('bold','timid','modest','calm') THEN nm_attack := 0.9; END IF;
  IF p_nature IN ('bold','relaxed','impish','lax') THEN nm_defense := 1.1; END IF;
  IF p_nature IN ('lonely','hasty','mild','gentle') THEN nm_defense := 0.9; END IF;
  IF p_nature IN ('timid','hasty','jolly','naive') THEN nm_speed := 1.1; END IF;
  IF p_nature IN ('brave','relaxed','quiet','sassy') THEN nm_speed := 0.9; END IF;
  IF p_nature IN ('modest','mild','quiet','rash') THEN nm_sp_atk := 1.1; END IF;
  IF p_nature IN ('adamant','impish','jolly','careful') THEN nm_sp_atk := 0.9; END IF;
  IF p_nature IN ('calm','gentle','sassy','careful') THEN nm_sp_def := 1.1; END IF;
  IF p_nature IN ('naughty','lax','rash','naive') THEN nm_sp_def := 0.9; END IF;

  stat_hp := FLOOR(((2*p_hp + p_iv_hp + FLOOR(p_ev_hp/4)) * p_level / 100) + p_level + 10)::INT;
  stat_attack := FLOOR((((2*p_attack + p_iv_attack + FLOOR(p_ev_attack/4)) * p_level / 100) + 5) * nm_attack)::INT;
  stat_defense := FLOOR((((2*p_defense + p_iv_defense + FLOOR(p_ev_defense/4)) * p_level / 100) + 5) * nm_defense)::INT;
  stat_sp_atk := FLOOR((((2*p_sp_atk + p_iv_sp_atk + FLOOR(p_ev_sp_atk/4)) * p_level / 100) + 5) * nm_sp_atk)::INT;
  stat_sp_def := FLOOR((((2*p_sp_def + p_iv_sp_def + FLOOR(p_ev_sp_def/4)) * p_level / 100) + 5) * nm_sp_def)::INT;
  stat_speed := FLOOR((((2*p_speed + p_iv_speed + FLOOR(p_ev_speed/4)) * p_level / 100) + 5) * nm_speed)::INT;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION compute_power(
  p_hp INT, p_attack INT, p_defense INT, p_sp_atk INT, p_sp_def INT, p_speed INT,
  p_level INT, p_iv_hp INT, p_iv_attack INT, p_iv_defense INT, p_iv_sp_atk INT, p_iv_sp_def INT, p_iv_speed INT,
  p_ev_hp INT, p_ev_attack INT, p_ev_defense INT, p_ev_sp_atk INT, p_ev_sp_def INT, p_ev_speed INT,
  p_nature TEXT
) RETURNS INTEGER AS $$
DECLARE
  s RECORD;
  iv_sum INT; ev_sum INT; boost_stat TEXT; highest TEXT; nature_bonus INT := 0;
BEGIN
  SELECT * INTO s FROM compute_stats(p_hp, p_attack, p_defense, p_sp_atk, p_sp_def, p_speed, p_level,
    p_iv_hp, p_iv_attack, p_iv_defense, p_iv_sp_atk, p_iv_sp_def, p_iv_speed,
    p_ev_hp, p_ev_attack, p_ev_defense, p_ev_sp_atk, p_ev_sp_def, p_ev_speed, p_nature);

  iv_sum := p_iv_hp + p_iv_attack + p_iv_defense + p_iv_sp_atk + p_iv_sp_def + p_iv_speed;
  ev_sum := p_ev_hp + p_ev_attack + p_ev_defense + p_ev_sp_atk + p_ev_sp_def + p_ev_speed;

  boost_stat := CASE p_nature
    WHEN 'lonely' THEN 'attack' WHEN 'brave' THEN 'attack' WHEN 'adamant' THEN 'attack' WHEN 'naughty' THEN 'attack'
    WHEN 'bold' THEN 'defense' WHEN 'relaxed' THEN 'defense' WHEN 'impish' THEN 'defense' WHEN 'lax' THEN 'defense'
    WHEN 'timid' THEN 'speed' WHEN 'hasty' THEN 'speed' WHEN 'jolly' THEN 'speed' WHEN 'naive' THEN 'speed'
    WHEN 'modest' THEN 'spAtk' WHEN 'mild' THEN 'spAtk' WHEN 'quiet' THEN 'spAtk' WHEN 'rash' THEN 'spAtk'
    WHEN 'calm' THEN 'spDef' WHEN 'gentle' THEN 'spDef' WHEN 'sassy' THEN 'spDef' WHEN 'careful' THEN 'spDef'
    ELSE NULL END;

  highest := CASE
    WHEN p_hp >= p_attack AND p_hp >= p_defense AND p_hp >= p_sp_atk AND p_hp >= p_sp_def AND p_hp >= p_speed THEN 'hp'
    WHEN p_attack >= p_defense AND p_attack >= p_sp_atk AND p_attack >= p_sp_def AND p_attack >= p_speed THEN 'attack'
    WHEN p_defense >= p_sp_atk AND p_defense >= p_sp_def AND p_defense >= p_speed THEN 'defense'
    WHEN p_sp_atk >= p_sp_def AND p_sp_atk >= p_speed THEN 'spAtk'
    WHEN p_sp_def >= p_speed THEN 'spDef'
    ELSE 'speed' END;

  IF boost_stat IS NOT NULL AND boost_stat = highest THEN nature_bonus := 150; END IF;

  RETURN s.stat_hp + s.stat_attack + s.stat_defense + s.stat_sp_atk + s.stat_sp_def + s.stat_speed
    + iv_sum * 3 + FLOOR(ev_sum * 0.5)::INT + nature_bonus;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ------------------------------------------------------------
-- 3. CAPTURA segura (IV/nature gerados no servidor)
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS secure_capture_pokemon(UUID, INT, INT, BOOLEAN, JSONB);
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
-- 4. SAVE seguro do time (so campos de runtime; iv/ev/nature/shiny/level/pokemon_id travados)
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS secure_save_team(UUID, JSONB);
CREATE OR REPLACE FUNCTION secure_save_team(p_character_id UUID, p_team JSONB) RETURNS JSONB AS $$
DECLARE
  v_user_id UUID; v_row RECORD; v_el JSONB; v_pid UUID;
  v_poke RECORD; v_max_hp INT; v_power INT;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('error','Not authenticated'); END IF;
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

    UPDATE pokemon_team SET
      current_hp = LEAST(v_max_hp, COALESCE((v_el->>'current_hp')::INT, v_row.current_hp)),
      status_effect = COALESCE(v_el->>'status_effect', v_row.status_effect),
      moves = COALESCE((v_el->>'moves')::jsonb, v_row.moves),
      held_item_id = COALESCE((v_el->>'held_item_id')::INT, v_row.held_item_id),
      slot = COALESCE((v_el->>'slot')::INT, v_row.slot),
      power = v_power
    WHERE id = v_pid;
  END LOOP;

  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ------------------------------------------------------------
-- 5. EXP seguro (nivel calculado no servidor)
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS secure_grant_exp(UUID, UUID, INT);
CREATE OR REPLACE FUNCTION secure_grant_exp(p_character_id UUID, p_pokemon_team_id UUID, p_amount INT) RETURNS JSONB AS $$
DECLARE
  v_row RECORD; v_poke RECORD; v_new_exp INT; v_level INT; v_old_max INT; v_new_stats RECORD; v_power INT;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('error','Not authenticated'); END IF;
  SELECT * INTO v_row FROM pokemon_team WHERE id = p_pokemon_team_id AND character_id = p_character_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','Not authorized'); END IF;

  v_level := v_row.level;
  v_new_exp := COALESCE(v_row.experience, 0) + GREATEST(0, p_amount);
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

  RETURN jsonb_build_object('success', true, 'level', v_level, 'experience', v_new_exp,
    'stats_hp', v_new_stats.stat_hp, 'stats_attack', v_new_stats.stat_attack, 'stats_defense', v_new_stats.stat_defense,
    'stats_sp_atk', v_new_stats.stat_sp_atk, 'stats_sp_def', v_new_stats.stat_sp_def, 'stats_speed', v_new_stats.stat_speed);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ------------------------------------------------------------
-- 5b. LEVEL UP (Rare Candy) — +1 nivel, servidor recalcula
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS secure_level_up(UUID, UUID);
CREATE OR REPLACE FUNCTION secure_level_up(p_character_id UUID, p_pokemon_team_id UUID) RETURNS JSONB AS $$
DECLARE
  v_row RECORD; v_poke RECORD; v_level INT; v_old_max INT; v_new_stats RECORD; v_power INT;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('error','Not authenticated'); END IF;
  SELECT * INTO v_row FROM pokemon_team WHERE id = p_pokemon_team_id AND character_id = p_character_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','Not authorized'); END IF;

  v_level := LEAST(100, v_row.level + 1);
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
    level = v_level, experience = 0,
    current_hp = LEAST(v_new_stats.stat_hp, COALESCE(v_row.current_hp,0) + GREATEST(0, v_new_stats.stat_hp - v_old_max)),
    power = v_power
  WHERE id = p_pokemon_team_id;

  RETURN jsonb_build_object('success', true, 'level', v_level,
    'stats_hp', v_new_stats.stat_hp, 'stats_attack', v_new_stats.stat_attack, 'stats_defense', v_new_stats.stat_defense,
    'stats_sp_atk', v_new_stats.stat_sp_atk, 'stats_sp_def', v_new_stats.stat_sp_def, 'stats_speed', v_new_stats.stat_speed);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ------------------------------------------------------------
-- 6. SHINY seguro (item ja consumido no servidor via safe_remove_item)
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS secure_make_shiny(UUID, UUID);
CREATE OR REPLACE FUNCTION secure_make_shiny(p_character_id UUID, p_pokemon_team_id UUID) RETURNS JSONB AS $$
DECLARE v_row RECORD;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('error','Not authenticated'); END IF;
  SELECT * INTO v_row FROM pokemon_team WHERE id = p_pokemon_team_id AND character_id = p_character_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','Not authorized'); END IF;
  UPDATE pokemon_team SET is_shiny = true WHERE id = p_pokemon_team_id;
  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ------------------------------------------------------------
-- 7. EVOLUCAO segura (valida na tabela pokemon_evolutions)
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS secure_evolve(UUID, UUID, INT);
CREATE OR REPLACE FUNCTION secure_evolve(p_character_id UUID, p_pokemon_team_id UUID, p_to_pokemon_id INT) RETURNS JSONB AS $$
DECLARE
  v_row RECORD; v_poke RECORD; v_valid BOOLEAN; v_old_max INT; v_new_stats RECORD; v_power INT;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('error','Not authenticated'); END IF;
  SELECT * INTO v_row FROM pokemon_team WHERE id = p_pokemon_team_id AND character_id = p_character_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','Not authorized'); END IF;

  SELECT EXISTS(SELECT 1 FROM pokemon_evolutions WHERE from_pokemon_id = v_row.pokemon_id AND to_pokemon_id = p_to_pokemon_id) INTO v_valid;
  IF NOT v_valid THEN RETURN jsonb_build_object('error','Invalid evolution'); END IF;

  SELECT * INTO v_poke FROM pokemon WHERE id = p_to_pokemon_id;
  SELECT stat_hp INTO v_old_max FROM compute_stats(v_poke.hp, v_poke.attack, v_poke.defense, v_poke.sp_atk, v_poke.sp_def, v_poke.speed,
    v_row.level, v_row.iv_hp, v_row.iv_attack, v_row.iv_defense, v_row.iv_sp_atk, v_row.iv_sp_def, v_row.iv_speed,
    v_row.ev_hp, v_row.ev_attack, v_row.ev_defense, v_row.ev_sp_atk, v_row.ev_sp_def, v_row.ev_speed, v_row.nature);
  SELECT * INTO v_new_stats FROM compute_stats(v_poke.hp, v_poke.attack, v_poke.defense, v_poke.sp_atk, v_poke.sp_def, v_poke.speed,
    v_row.level, v_row.iv_hp, v_row.iv_attack, v_row.iv_defense, v_row.iv_sp_atk, v_row.iv_sp_def, v_row.iv_speed,
    v_row.ev_hp, v_row.ev_attack, v_row.ev_defense, v_row.ev_sp_atk, v_row.ev_sp_def, v_row.ev_speed, v_row.nature);
  v_power := compute_power(v_poke.hp, v_poke.attack, v_poke.defense, v_poke.sp_atk, v_poke.sp_def, v_poke.speed,
    v_row.level, v_row.iv_hp, v_row.iv_attack, v_row.iv_defense, v_row.iv_sp_atk, v_row.iv_sp_def, v_row.iv_speed,
    v_row.ev_hp, v_row.ev_attack, v_row.ev_defense, v_row.ev_sp_atk, v_row.ev_sp_def, v_row.ev_speed, v_row.nature);

  UPDATE pokemon_team SET
    pokemon_id = p_to_pokemon_id, species = v_poke.name, nickname = v_poke.name,
    current_hp = LEAST(v_new_stats.stat_hp, COALESCE(v_row.current_hp,0) + GREATEST(0, v_new_stats.stat_hp - v_old_max)),
    power = v_power
  WHERE id = p_pokemon_team_id;

  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ------------------------------------------------------------
-- 8. MEGA EVOLUCAO segura (valida na tabela mega_evolutions)
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS secure_mega_evolve(UUID, UUID, INT);
CREATE OR REPLACE FUNCTION secure_mega_evolve(p_character_id UUID, p_pokemon_team_id UUID, p_to_pokemon_id INT) RETURNS JSONB AS $$
DECLARE
  v_row RECORD; v_poke RECORD; v_valid BOOLEAN; v_old_max INT; v_new_stats RECORD; v_power INT;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('error','Not authenticated'); END IF;
  SELECT * INTO v_row FROM pokemon_team WHERE id = p_pokemon_team_id AND character_id = p_character_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','Not authorized'); END IF;

  SELECT EXISTS(SELECT 1 FROM mega_evolutions WHERE base_pokemon_id = v_row.pokemon_id AND mega_pokemon_id = p_to_pokemon_id) INTO v_valid;
  IF NOT v_valid THEN RETURN jsonb_build_object('error','Invalid mega evolution'); END IF;

  SELECT * INTO v_poke FROM pokemon WHERE id = p_to_pokemon_id;
  SELECT stat_hp INTO v_old_max FROM compute_stats(v_poke.hp, v_poke.attack, v_poke.defense, v_poke.sp_atk, v_poke.sp_def, v_poke.speed,
    v_row.level, v_row.iv_hp, v_row.iv_attack, v_row.iv_defense, v_row.iv_sp_atk, v_row.iv_sp_def, v_row.iv_speed,
    v_row.ev_hp, v_row.ev_attack, v_row.ev_defense, v_row.ev_sp_atk, v_row.ev_sp_def, v_row.ev_speed, v_row.nature);
  SELECT * INTO v_new_stats FROM compute_stats(v_poke.hp, v_poke.attack, v_poke.defense, v_poke.sp_atk, v_poke.sp_def, v_poke.speed,
    v_row.level, v_row.iv_hp, v_row.iv_attack, v_row.iv_defense, v_row.iv_sp_atk, v_row.iv_sp_def, v_row.iv_speed,
    v_row.ev_hp, v_row.ev_attack, v_row.ev_defense, v_row.ev_sp_atk, v_row.ev_sp_def, v_row.ev_speed, v_row.nature);
  v_power := compute_power(v_poke.hp, v_poke.attack, v_poke.defense, v_poke.sp_atk, v_poke.sp_def, v_poke.speed,
    v_row.level, v_row.iv_hp, v_row.iv_attack, v_row.iv_defense, v_row.iv_sp_atk, v_row.iv_sp_def, v_row.iv_speed,
    v_row.ev_hp, v_row.ev_attack, v_row.ev_defense, v_row.ev_sp_atk, v_row.ev_sp_def, v_row.ev_speed, v_row.nature);

  UPDATE pokemon_team SET
    pokemon_id = p_to_pokemon_id, species = v_poke.name, nickname = v_poke.name, is_mega = true,
    current_hp = LEAST(v_new_stats.stat_hp, COALESCE(v_row.current_hp,0) + GREATEST(0, v_new_stats.stat_hp - v_old_max)),
    power = v_power
  WHERE id = p_pokemon_team_id;

  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ------------------------------------------------------------
-- 9. Nivel do treinador (calculado no servidor) + trigger bloqueando escrita direta
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION block_trainer_level_cheat() RETURNS trigger AS $$
BEGIN
  IF current_setting('app.allow_trainer', true) IS DISTINCT FROM 'true' THEN
    IF NEW.trainer_level IS DISTINCT FROM OLD.trainer_level OR NEW.trainer_exp IS DISTINCT FROM OLD.trainer_exp THEN
      RAISE EXCEPTION 'trainer_level/trainer_exp so podem ser alterados via RPC do servidor';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_block_trainer_level ON game_saves;
CREATE TRIGGER trg_block_trainer_level BEFORE UPDATE ON game_saves
FOR EACH ROW EXECUTE FUNCTION block_trainer_level_cheat();

DROP FUNCTION IF EXISTS secure_gain_trainer_exp(UUID, INT);
CREATE OR REPLACE FUNCTION secure_gain_trainer_exp(p_character_id UUID, p_amount INT) RETURNS JSONB AS $$
DECLARE
  v_user_id UUID; v_level INT; v_exp INT;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('error','Not authenticated'); END IF;
  SELECT user_id INTO v_user_id FROM game_saves WHERE id = p_character_id;
  IF v_user_id IS DISTINCT FROM auth.uid() THEN RETURN jsonb_build_object('error','Not authorized'); END IF;

  SELECT trainer_level, trainer_exp INTO v_level, v_exp FROM game_saves WHERE id = p_character_id;
  v_exp := COALESCE(v_exp, 0) + GREATEST(0, p_amount);
  WHILE v_level < 100 AND v_exp >= trainer_exp_for_level(v_level) LOOP
    v_exp := v_exp - trainer_exp_for_level(v_level);
    v_level := v_level + 1;
  END LOOP;
  IF v_level >= 100 THEN v_exp := 0; END IF;

  PERFORM set_config('app.allow_trainer', 'true', true);
  UPDATE game_saves SET trainer_level = v_level, trainer_exp = v_exp WHERE id = p_character_id;
  PERFORM set_config('app.allow_trainer', '', true);

  RETURN jsonb_build_object('success', true, 'level', v_level, 'experience', v_exp);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ------------------------------------------------------------
-- 10. SACAR DO PC seguro (move pokemon_pc -> pokemon_team no servidor)
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS secure_withdraw_pc(UUID, UUID);
CREATE OR REPLACE FUNCTION secure_withdraw_pc(p_character_id UUID, p_pokemon_pc_id UUID) RETURNS JSONB AS $$
DECLARE
  v_user_id UUID; v_poke RECORD; v_pc RECORD; v_team_count INT; v_power INT; v_new_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('error','Not authenticated'); END IF;
  SELECT user_id INTO v_user_id FROM game_saves WHERE id = p_character_id;
  IF v_user_id IS DISTINCT FROM auth.uid() THEN RETURN jsonb_build_object('error','Not authorized'); END IF;

  SELECT * INTO v_pc FROM pokemon_pc WHERE id = p_pokemon_pc_id AND character_id = p_character_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','Pokemon not found in PC'); END IF;

  SELECT COUNT(*) INTO v_team_count FROM pokemon_team WHERE character_id = p_character_id;
  IF v_team_count >= 6 THEN RETURN jsonb_build_object('error','Team full'); END IF;

  SELECT * INTO v_poke FROM pokemon WHERE id = v_pc.pokemon_id;
  v_power := compute_power(COALESCE(v_poke.hp,50), COALESCE(v_poke.attack,50), COALESCE(v_poke.defense,50), COALESCE(v_poke.sp_atk,50), COALESCE(v_poke.sp_def,50), COALESCE(v_poke.speed,50),
    v_pc.level, v_pc.iv_hp, v_pc.iv_attack, v_pc.iv_defense, v_pc.iv_sp_atk, v_pc.iv_sp_def, v_pc.iv_speed,
    v_pc.ev_hp, v_pc.ev_attack, v_pc.ev_defense, v_pc.ev_sp_atk, v_pc.ev_sp_def, v_pc.ev_speed, v_pc.nature);

  INSERT INTO pokemon_team (user_id, character_id, pokemon_id, species, nickname, level, current_hp, max_hp, experience, moves, is_active, slot, iv_hp, iv_attack, iv_defense, iv_sp_atk, iv_sp_def, iv_speed, ev_hp, ev_attack, ev_defense, ev_sp_atk, ev_sp_def, ev_speed, nature, happiness, is_shiny, is_mega, held_item_id, power)
  VALUES (auth.uid(), p_character_id, v_pc.pokemon_id, v_pc.species, COALESCE(v_pc.nickname, v_pc.species), v_pc.level, COALESCE(v_pc.current_hp, v_pc.max_hp), COALESCE(v_pc.max_hp, 10), COALESCE(v_pc.experience, 0), COALESCE(v_pc.moves, '[]'::jsonb), false, v_team_count + 1, v_pc.iv_hp, v_pc.iv_attack, v_pc.iv_defense, v_pc.iv_sp_atk, v_pc.iv_sp_def, v_pc.iv_speed, v_pc.ev_hp, v_pc.ev_attack, v_pc.ev_defense, v_pc.ev_sp_atk, v_pc.ev_sp_def, v_pc.ev_speed, v_pc.nature, COALESCE(v_pc.happiness, 70), v_pc.is_shiny, false, v_pc.held_item_id, v_power)
  RETURNING id INTO v_new_id;

  DELETE FROM pokemon_pc WHERE id = p_pokemon_pc_id;

  RETURN jsonb_build_object('success', true, 'id', v_new_id, 'pokemon_name', v_pc.species);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ------------------------------------------------------------
-- 11. REMOVER do time (deposito no PC / liberar) seguro
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS secure_delete_team_pokemon(UUID, UUID);
CREATE OR REPLACE FUNCTION secure_delete_team_pokemon(p_character_id UUID, p_pokemon_team_id UUID) RETURNS JSONB AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('error','Not authenticated'); END IF;
  IF NOT EXISTS(SELECT 1 FROM pokemon_team WHERE id = p_pokemon_team_id AND character_id = p_character_id) THEN
    RETURN jsonb_build_object('error','Not authorized');
  END IF;
  DELETE FROM pokemon_team WHERE id = p_pokemon_team_id AND character_id = p_character_id;
  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
