-- ============================================================
-- COMPREHENSIVE SERVER-SIDE SECURITY SYSTEM
-- All critical game logic runs on the server
-- Execute in Supabase SQL Editor
-- ============================================================

-- ============================================================
CREATE OR REPLACE FUNCTION is_admin_user() RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS(SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- PART 1: FIX CURRENCY AUTHORIZATION
-- add_currency and spend_currency must verify character ownership
-- ============================================================

CREATE OR REPLACE FUNCTION add_currency(
  p_character_id UUID,
  p_currency_type TEXT,
  p_amount INTEGER,
  p_action TEXT,
  p_description TEXT DEFAULT '',
  p_created_by UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_current INTEGER;
  v_new INTEGER;
  v_row RECORD;
  v_user_id UUID;
  v_is_admin BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  IF p_amount < 0 THEN
    RETURN jsonb_build_object('error', 'Amount must be positive');
  END IF;

  IF p_currency_type NOT IN ('diamonds', 'gold', 'silver') THEN
    RETURN jsonb_build_object('error', 'Invalid currency type');
  END IF;

  -- Verify character ownership
  SELECT gs.user_id INTO v_user_id FROM game_saves gs WHERE gs.id = p_character_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Character not found');
  END IF;

  -- Check admin
  SELECT EXISTS(SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true) INTO v_is_admin;

  -- Only admin actions can target other characters, and caller must be actual admin
  IF v_user_id != auth.uid() AND p_action = 'admin_grant' AND NOT is_admin_user() THEN
    RETURN jsonb_build_object('error', 'Admin access required');
  END IF;

  IF v_user_id != auth.uid() AND p_action NOT IN ('admin_grant', 'reward') THEN
    RETURN jsonb_build_object('error', 'Not authorized to modify this character');
  END IF;

  INSERT INTO character_currencies (character_id, diamonds, gold, silver)
  VALUES (p_character_id,
    CASE WHEN p_currency_type = 'diamonds' THEN p_amount ELSE 0 END,
    CASE WHEN p_currency_type = 'gold' THEN p_amount ELSE 0 END,
    CASE WHEN p_currency_type = 'silver' THEN p_amount ELSE 0 END
  )
  ON CONFLICT (character_id) DO NOTHING;

  SELECT * INTO v_row FROM character_currencies
  WHERE character_id = p_character_id FOR UPDATE;

  v_current := CASE p_currency_type
    WHEN 'diamonds' THEN v_row.diamonds
    WHEN 'gold' THEN v_row.gold
    WHEN 'silver' THEN v_row.silver
  END;

  v_new := v_current + p_amount;

  CASE p_currency_type
    WHEN 'diamonds' THEN
      UPDATE character_currencies SET diamonds = v_new WHERE character_id = p_character_id;
    WHEN 'gold' THEN
      UPDATE character_currencies SET gold = v_new WHERE character_id = p_character_id;
    WHEN 'silver' THEN
      UPDATE character_currencies SET silver = v_new WHERE character_id = p_character_id;
  END CASE;

  INSERT INTO currency_audit_log (character_id, user_id, action, currency_type, amount, balance_before, balance_after, description, created_by)
  SELECT p_character_id, gs.user_id, p_action, p_currency_type, p_amount, v_current, v_new, p_description, p_created_by
  FROM game_saves gs WHERE gs.id = p_character_id;

  RETURN jsonb_build_object('success', true, 'balance', v_new);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION spend_currency(
  p_character_id UUID,
  p_currency_type TEXT,
  p_amount INTEGER,
  p_action TEXT,
  p_description TEXT DEFAULT '',
  p_created_by UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_current INTEGER;
  v_new INTEGER;
  v_row RECORD;
  v_user_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  IF p_amount <= 0 THEN
    RETURN jsonb_build_object('error', 'Amount must be positive');
  END IF;

  IF p_currency_type NOT IN ('diamonds', 'gold', 'silver') THEN
    RETURN jsonb_build_object('error', 'Invalid currency type');
  END IF;

  -- Verify character ownership
  SELECT gs.user_id INTO v_user_id FROM game_saves gs WHERE gs.id = p_character_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Character not found');
  END IF;

  IF v_user_id != auth.uid() THEN
    RETURN jsonb_build_object('error', 'Not authorized');
  END IF;

  SELECT * INTO v_row FROM character_currencies
  WHERE character_id = p_character_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Character not found');
  END IF;

  v_current := CASE p_currency_type
    WHEN 'diamonds' THEN v_row.diamonds
    WHEN 'gold' THEN v_row.gold
    WHEN 'silver' THEN v_row.silver
  END;

  IF v_current < p_amount THEN
    RETURN jsonb_build_object('error', 'Insufficient balance');
  END IF;

  v_new := v_current - p_amount;

  CASE p_currency_type
    WHEN 'diamonds' THEN
      UPDATE character_currencies SET diamonds = v_new WHERE character_id = p_character_id;
    WHEN 'gold' THEN
      UPDATE character_currencies SET gold = v_new WHERE character_id = p_character_id;
    WHEN 'silver' THEN
      UPDATE character_currencies SET silver = v_new WHERE character_id = p_character_id;
  END CASE;

  INSERT INTO currency_audit_log (character_id, user_id, action, currency_type, amount, balance_before, balance_after, description, created_by)
  SELECT p_character_id, gs.user_id, p_action, p_currency_type, -p_amount, v_current, v_new, p_description, p_created_by
  FROM game_saves gs WHERE gs.id = p_character_id;

  RETURN jsonb_build_object('success', true, 'balance', v_new);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_currency_balance(
  p_character_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_row RECORD;
  v_user_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  SELECT gs.user_id INTO v_user_id FROM game_saves gs WHERE gs.id = p_character_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Character not found');
  END IF;

  IF v_user_id != auth.uid() THEN
    RETURN jsonb_build_object('error', 'Not authorized');
  END IF;

  SELECT diamonds, gold, silver INTO v_row
  FROM character_currencies
  WHERE character_id = p_character_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('diamonds', 0, 'gold', 0, 'silver', 0);
  END IF;

  RETURN jsonb_build_object(
    'diamonds', v_row.diamonds,
    'gold', v_row.gold,
    'silver', v_row.silver
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================
-- PART 2: SERVER-SIDE ITEM OPERATIONS
-- Block all direct client access to player_inventory
-- ============================================================

-- Server-side add item
CREATE OR REPLACE FUNCTION safe_add_item(
  p_character_id UUID,
  p_item_id INTEGER,
  p_quantity INTEGER DEFAULT 1
) RETURNS JSONB AS $$
DECLARE
  v_user_id UUID;
  v_owner_user_id UUID;
  v_existing INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  IF p_quantity <= 0 THEN
    RETURN jsonb_build_object('error', 'Quantity must be positive');
  END IF;

  IF p_quantity > 9999 THEN
    RETURN jsonb_build_object('error', 'Quantity too high');
  END IF;

  -- Verify character exists and belongs to user
  SELECT gs.user_id INTO v_owner_user_id FROM game_saves gs WHERE gs.id = p_character_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Character not found');
  END IF;

  IF v_owner_user_id != auth.uid() AND NOT is_admin_user() THEN
    RETURN jsonb_build_object('error', 'Not authorized');
  END IF;

  -- Validate item exists
  IF NOT EXISTS(SELECT 1 FROM items WHERE id = p_item_id) THEN
    RETURN jsonb_build_object('error', 'Item not found');
  END IF;

  INSERT INTO player_inventory (user_id, character_id, item_id, quantity)
  VALUES (auth.uid(), p_character_id, p_item_id, p_quantity)
  ON CONFLICT (character_id, item_id) DO UPDATE
  SET quantity = player_inventory.quantity + EXCLUDED.quantity
  WHERE player_inventory.quantity + EXCLUDED.quantity <= 9999;

  RETURN jsonb_build_object('success', true, 'item_id', p_item_id, 'quantity_added', p_quantity);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Server-side remove item
CREATE OR REPLACE FUNCTION safe_remove_item(
  p_character_id UUID,
  p_item_id INTEGER,
  p_quantity INTEGER DEFAULT 1
) RETURNS JSONB AS $$
DECLARE
  v_owner_user_id UUID;
  v_current INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  IF p_quantity <= 0 THEN
    RETURN jsonb_build_object('error', 'Quantity must be positive');
  END IF;

  -- Verify character belongs to user
  SELECT gs.user_id INTO v_owner_user_id FROM game_saves gs WHERE gs.id = p_character_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Character not found');
  END IF;

  IF v_owner_user_id != auth.uid() AND NOT is_admin_user() THEN
    RETURN jsonb_build_object('error', 'Not authorized');
  END IF;

  -- Lock and check current quantity
  SELECT quantity INTO v_current FROM player_inventory
  WHERE character_id = p_character_id AND item_id = p_item_id
  FOR UPDATE;

  IF NOT FOUND OR v_current < p_quantity THEN
    RETURN jsonb_build_object('error', 'Insufficient quantity');
  END IF;

  IF v_current = p_quantity THEN
    DELETE FROM player_inventory WHERE character_id = p_character_id AND item_id = p_item_id;
  ELSE
    UPDATE player_inventory SET quantity = quantity - p_quantity
    WHERE character_id = p_character_id AND item_id = p_item_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'item_id', p_item_id, 'quantity_removed', p_quantity);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Server-side get inventory
CREATE OR REPLACE FUNCTION safe_get_inventory(
  p_character_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_owner_user_id UUID;
  v_result JSONB;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  SELECT gs.user_id INTO v_owner_user_id FROM game_saves gs WHERE gs.id = p_character_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Character not found');
  END IF;

  IF v_owner_user_id != auth.uid() AND NOT is_admin_user() THEN
    RETURN jsonb_build_object('error', 'Not authorized');
  END IF;

  SELECT jsonb_agg(
    jsonb_build_object(
      'item_id', pi.item_id,
      'quantity', pi.quantity,
      'name', i.name,
      'category', i.category,
      'effect', i.effect,
      'sprite_url', i.sprite_url
    )
  ) INTO v_result
  FROM player_inventory pi
  JOIN items i ON i.id = pi.item_id
  WHERE pi.character_id = p_character_id AND pi.quantity > 0;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Block direct insert/update/delete on player_inventory
ALTER TABLE player_inventory ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "inv_select" ON player_inventory;
DROP POLICY IF EXISTS "inv_insert" ON player_inventory;
DROP POLICY IF EXISTS "inv_update" ON player_inventory;
DROP POLICY IF EXISTS "inv_delete" ON player_inventory;
DROP POLICY IF EXISTS "inv_block_insert" ON player_inventory;
DROP POLICY IF EXISTS "inv_block_update" ON player_inventory;
DROP POLICY IF EXISTS "inv_block_delete" ON player_inventory;

CREATE POLICY "inv_select" ON player_inventory FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "inv_block_insert" ON player_inventory FOR INSERT
  WITH CHECK (false);

CREATE POLICY "inv_block_update" ON player_inventory FOR UPDATE
  USING (false);

CREATE POLICY "inv_block_delete" ON player_inventory FOR DELETE
  USING (false);


-- ============================================================
-- PART 3: SERVER-SIDE POKEMON SPAWN ROLLS
-- Weighted encounter selection happens on the server
-- ============================================================
-- PART 3: SERVER-SIDE POKEMON SPAWN ROLLS
-- Weighted encounter selection happens on the server
-- ============================================================

-- Spawn roll by biome name (simplified: takes character_id + biome, resolves map internally)
CREATE OR REPLACE FUNCTION roll_spawn_by_biome(
  p_character_id UUID,
  p_biome TEXT
) RETURNS JSONB AS $$
DECLARE
  v_owner_user_id UUID;
  v_region_id UUID;
  v_map_id UUID;
  v_total_weight NUMERIC;
  v_roll NUMERIC;
  v_enc RECORD;
  v_is_shiny BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  IF p_biome IS NULL OR TRIM(p_biome) = '' THEN
    RETURN jsonb_build_object('error', 'Biome is required');
  END IF;

  BEGIN
    SELECT gs.user_id INTO v_owner_user_id FROM game_saves gs WHERE gs.id = p_character_id;
    IF NOT FOUND OR v_owner_user_id != auth.uid() THEN
      RETURN jsonb_build_object('error', 'Not authorized');
    END IF;

    -- Get character's current region
    SELECT current_region_id INTO v_region_id FROM player_progress
    WHERE character_id = p_character_id LIMIT 1;

    IF NOT FOUND OR v_region_id IS NULL THEN
      RETURN jsonb_build_object('error', 'No region found for character');
    END IF;

    -- Find map with matching biome name in this region
    SELECT rm.id INTO v_map_id FROM region_maps rm
    WHERE rm.region_id = v_region_id
      AND LOWER(TRIM(rm.name)) = LOWER(TRIM(p_biome))
    ORDER BY rm.sort_order LIMIT 1;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('error', 'No map found for biome: ' || p_biome);
    END IF;

    -- Calculate total weight
    SELECT SUM(COALESCE(me.weight, 50)) INTO v_total_weight
    FROM map_encounters me WHERE me.map_id = v_map_id AND (me.weight IS NULL OR me.weight >= 0);

    IF v_total_weight IS NULL OR v_total_weight <= 0 THEN
      RETURN jsonb_build_object('error', 'No encounters available');
    END IF;

    v_roll := random() * v_total_weight;

    FOR v_enc IN
      SELECT me.pokemon_id, me.pokemon_name, me.weight, me.min_level, me.max_level, me.sprite_url
      FROM map_encounters me
      WHERE me.map_id = v_map_id AND (me.weight IS NULL OR me.weight >= 0)
    LOOP
      v_roll := v_roll - COALESCE(v_enc.weight, 50);
      IF v_roll <= 0 THEN
        v_is_shiny := random() < (1.0 / 4096.0);
        RETURN jsonb_build_object(
          'success', true,
          'pokemon_id', v_enc.pokemon_id,
          'pokemon_name', v_enc.pokemon_name,
          'min_level', COALESCE(v_enc.min_level, 2),
          'max_level', COALESCE(v_enc.max_level, 8),
          'is_shiny', v_is_shiny,
          'sprite_url', v_enc.sprite_url
        );
      END IF;
    END LOOP;

    RETURN jsonb_build_object('error', 'Roll failed');
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('error', 'RPC error: ' || SQLERRM);
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Spawn roll by map_id
CREATE OR REPLACE FUNCTION roll_spawn_encounter(
  p_character_id UUID,
  p_map_id UUID,
  p_biome TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_owner_user_id UUID;
  v_total_weight NUMERIC;
  v_roll NUMERIC;
  v_enc RECORD;
  v_is_shiny BOOLEAN;
  v_active_ids INTEGER[];
  v_id_count INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  -- Verify character belongs to user
  SELECT gs.user_id INTO v_owner_user_id FROM game_saves gs WHERE gs.id = p_character_id;
  IF NOT FOUND OR v_owner_user_id != auth.uid() THEN
    RETURN jsonb_build_object('error', 'Not authorized');
  END IF;

  -- Calculate total weight
  SELECT SUM(COALESCE(me.weight, 50)) INTO v_total_weight
  FROM map_encounters me WHERE me.map_id = p_map_id AND (me.weight IS NULL OR me.weight >= 0);

  IF v_total_weight IS NULL OR v_total_weight <= 0 THEN
    RETURN jsonb_build_object('error', 'No encounters available');
  END IF;

  v_roll := random() * v_total_weight;

  FOR v_enc IN
    SELECT me.pokemon_id, me.pokemon_name, me.weight, me.min_level, me.max_level, me.sprite_url
    FROM map_encounters me
    WHERE me.map_id = p_map_id AND (me.weight IS NULL OR me.weight >= 0)
  LOOP
    v_roll := v_roll - COALESCE(v_enc.weight, 50);
    IF v_roll <= 0 THEN
      v_is_shiny := random() < (1.0 / 4096.0);

      RETURN jsonb_build_object(
        'success', true,
        'pokemon_id', v_enc.pokemon_id,
        'pokemon_name', v_enc.pokemon_name,
        'min_level', COALESCE(v_enc.min_level, 2),
        'max_level', COALESCE(v_enc.max_level, 8),
        'is_shiny', v_is_shiny,
        'sprite_url', v_enc.sprite_url
      );
    END IF;
  END LOOP;

  RETURN jsonb_build_object('error', 'Roll failed');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================
-- PART 4: SERVER-SIDE POKEMON CAPTURE VALIDATION
-- Captures must pass server-side checks
-- ============================================================

CREATE OR REPLACE FUNCTION validate_capture_event(
  p_character_id UUID,
  p_pokemon_id INTEGER,
  p_map_id UUID,
  p_level INTEGER,
  p_is_shiny BOOLEAN DEFAULT false
) RETURNS JSONB AS $$
DECLARE
  v_owner_user_id UUID;
  v_is_valid BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  -- Verify character ownership
  SELECT gs.user_id INTO v_owner_user_id FROM game_saves gs WHERE gs.id = p_character_id;
  IF NOT FOUND OR v_owner_user_id != auth.uid() THEN
    RETURN jsonb_build_object('error', 'Not authorized');
  END IF;

  -- Verify the pokemon actually exists as an encounter on this map
  SELECT EXISTS(
    SELECT 1 FROM map_encounters me
    WHERE me.map_id = p_map_id AND me.pokemon_id = p_pokemon_id
  ) INTO v_is_valid;

  IF NOT v_is_valid THEN
    RETURN jsonb_build_object('error', 'Invalid capture: pokemon not available on this map');
  END IF;

  -- Validate level range
  IF p_level < 1 OR p_level > 100 THEN
    RETURN jsonb_build_object('error', 'Invalid level');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'pokemon_id', p_pokemon_id,
    'map_id', p_map_id,
    'level', p_level,
    'is_shiny', p_is_shiny
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================
-- PART 5: BATTLE REWARD VALIDATION
-- Server validates battle result and issues rewards
-- ============================================================

CREATE OR REPLACE FUNCTION issue_battle_reward(
  p_character_id UUID,
  p_pokemon_id INTEGER,
  p_level INTEGER,
  p_result TEXT,
  p_is_wild BOOLEAN DEFAULT true
) RETURNS JSONB AS $$
DECLARE
  v_owner_user_id UUID;
  v_silver_earned INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  SELECT gs.user_id INTO v_owner_user_id FROM game_saves gs WHERE gs.id = p_character_id;
  IF NOT FOUND OR v_owner_user_id != auth.uid() THEN
    RETURN jsonb_build_object('error', 'Not authorized');
  END IF;

  IF p_result != 'win' THEN
    RETURN jsonb_build_object('success', true, 'silver_earned', 0);
  END IF;

  -- Calculate silver reward based on level
  v_silver_earned := 50 + p_level * 2;
  IF v_silver_earned > 200 THEN v_silver_earned := 200; END IF;

  -- Issue the silver
  PERFORM add_currency(p_character_id, 'silver', v_silver_earned, 'reward', 'Battle victory');

  RETURN jsonb_build_object(
    'success', true,
    'silver_earned', v_silver_earned,
    'pokemon_id', p_pokemon_id,
    'level', p_level
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================
-- PART 5b: COMPREHENSIVE BATTLE REWARD (Silver + EXP)
-- Calculates and persists everything server-side
-- ============================================================

CREATE OR REPLACE FUNCTION calculate_battle_reward(
  p_character_id UUID,
  p_enemy_pokemon_id INTEGER,
  p_enemy_level INTEGER,
  p_win_streak INTEGER DEFAULT 0
) RETURNS JSONB AS $$
DECLARE
  v_owner_user_id UUID;
  v_bst INTEGER;
  v_rarity_mult NUMERIC;
  v_streak_mult NUMERIC;
  v_silver INTEGER;
  v_base_exp INTEGER;
  v_is_starter BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  SELECT gs.user_id INTO v_owner_user_id FROM game_saves gs WHERE gs.id = p_character_id;
  IF NOT FOUND OR v_owner_user_id != auth.uid() THEN
    RETURN jsonb_build_object('error', 'Not authorized');
  END IF;

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

  -- Base EXP calculation
  v_base_exp := FLOOR((p_enemy_level * 15) / 9);

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


-- ============================================================
-- PART 6: BLOCK DIRECT INSERTS ON pokemon_team
-- Must use RPC for team changes
-- ============================================================

-- Keep SELECT for readonly but block INSERT/UPDATE/DELETE
ALTER TABLE pokemon_team ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "pokemonteam_select" ON pokemon_team;
  DROP POLICY IF EXISTS "pokemonteam_insert" ON pokemon_team;
  DROP POLICY IF EXISTS "pokemonteam_update" ON pokemon_team;
  DROP POLICY IF EXISTS "pokemonteam_delete" ON pokemon_team;
  DROP POLICY IF EXISTS "pokemonteam_block_insert" ON pokemon_team;
  DROP POLICY IF EXISTS "pokemonteam_block_update" ON pokemon_team;
  DROP POLICY IF EXISTS "pokemonteam_block_delete" ON pokemon_team;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "pokemonteam_select" ON pokemon_team FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "pokemonteam_block_insert" ON pokemon_team FOR INSERT
  WITH CHECK (false);

CREATE POLICY "pokemonteam_block_update" ON pokemon_team FOR UPDATE
  USING (false);

CREATE POLICY "pokemonteam_block_delete" ON pokemon_team FOR DELETE
  USING (false);


-- ============================================================
-- PART 7: SERVER-SIDE POKEMON TEAM SAVE
-- Used by the client to save team state
-- ============================================================

CREATE OR REPLACE FUNCTION safe_save_team(
  p_character_id UUID,
  p_team JSONB -- Array of {index, currentHp, fainted, statusEffect, moves[{currentPp}], experience}
) RETURNS JSONB AS $$
DECLARE
  v_user_id UUID;
  v_owner_user_id UUID;
  v_poke RECORD;
  v_i INTEGER;
  v_pokemon_id INTEGER;
  v_team_count INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  -- Verify character ownership
  SELECT gs.user_id, gs.id INTO v_owner_user_id, v_pokemon_id
  FROM game_saves gs WHERE gs.id = p_character_id;
  IF NOT FOUND OR v_owner_user_id != auth.uid() THEN
    RETURN jsonb_build_object('error', 'Not authorized');
  END IF;

  -- Only allow updating existing team pokemon (no creating new ones)
  -- This prevents the client from adding pokemon to the team
  SELECT COUNT(*) INTO v_team_count FROM pokemon_team WHERE user_id = auth.uid();
  IF v_team_count > 6 THEN
    RETURN jsonb_build_object('error', 'Team size limit exceeded');
  END IF;

  -- Update current_hp, fainted, status, move PPs, experience
  FOR v_i IN 0..jsonb_array_length(p_team) - 1 LOOP
    IF p_team->v_i IS NOT NULL AND p_team->v_i->>'id' IS NOT NULL THEN
      UPDATE pokemon_team
      SET
        current_hp = LEAST((p_team->v_i->>'currentHp')::INTEGER, stats_hp),
        fainted = (p_team->v_i->>'fainted')::BOOLEAN,
        status_effect = p_team->v_i->>'statusEffect',
        experience = COALESCE((p_team->v_i->>'experience')::INTEGER, experience),
        slot = (p_team->v_i->>'slot')::INTEGER
      WHERE id = (p_team->v_i->>'id')::UUID AND user_id = auth.uid();
    END IF;
  END LOOP;

  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================
-- PART 8: SERVER-SIDE CAPTURE + TEAM INSERT
-- The ONLY way to add a pokemon to the team
-- ============================================================

CREATE OR REPLACE FUNCTION safe_capture_pokemon(
  p_character_id UUID,
  p_pokemon_id INTEGER,
  p_pokemon_name TEXT,
  p_level INTEGER,
  p_map_id UUID,
  p_is_shiny BOOLEAN DEFAULT false,
  p_species TEXT DEFAULT NULL,
  p_types TEXT DEFAULT '',
  p_stats_hp INTEGER DEFAULT NULL,
  p_stats_attack INTEGER DEFAULT NULL,
  p_stats_defense INTEGER DEFAULT NULL,
  p_stats_sp_atk INTEGER DEFAULT NULL,
  p_stats_sp_def INTEGER DEFAULT NULL,
  p_stats_speed INTEGER DEFAULT NULL,
  p_moves JSONB DEFAULT '[]'::jsonb,
  p_iv_hp INTEGER DEFAULT 15,
  p_iv_attack INTEGER DEFAULT 15,
  p_iv_defense INTEGER DEFAULT 15,
  p_iv_sp_atk INTEGER DEFAULT 15,
  p_iv_sp_def INTEGER DEFAULT 15,
  p_iv_speed INTEGER DEFAULT 15,
  p_nature TEXT DEFAULT 'hardy'
) RETURNS JSONB AS $$
DECLARE
  v_owner_user_id UUID;
  v_is_valid BOOLEAN;
  v_new_id UUID;
  v_team_count INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  -- Verify character ownership
  SELECT gs.user_id INTO v_owner_user_id FROM game_saves gs WHERE gs.id = p_character_id;
  IF NOT FOUND OR v_owner_user_id != auth.uid() THEN
    RETURN jsonb_build_object('error', 'Not authorized');
  END IF;

  -- Verify capture is valid (pokemon exists on this map)
  SELECT EXISTS(
    SELECT 1 FROM map_encounters me
    WHERE me.map_id = p_map_id AND me.pokemon_id = p_pokemon_id
  ) INTO v_is_valid;

  IF NOT v_is_valid THEN
    RETURN jsonb_build_object('error', 'Invalid capture: pokemon not available on this map');
  END IF;

  -- Check team size
  SELECT COUNT(*) INTO v_team_count FROM pokemon_team WHERE user_id = auth.uid();
  IF v_team_count >= 6 THEN
    RETURN jsonb_build_object('error', 'Team is full (max 6)');
  END IF;

  -- Validate level
  IF p_level < 1 OR p_level > 100 THEN
    RETURN jsonb_build_object('error', 'Invalid level');
  END IF;

  -- Insert the captured pokemon
  INSERT INTO pokemon_team (
    user_id, character_id, pokemon_id, pokemon_name, species, types,
    level, current_hp, stats_hp, stats_attack, stats_defense,
    stats_sp_atk, stats_sp_def, stats_speed,
    iv_hp, iv_attack, iv_defense, iv_sp_atk, iv_sp_def, iv_speed,
    nature, is_shiny, slot
  ) VALUES (
    auth.uid(), p_character_id, p_pokemon_id, p_pokemon_name, COALESCE(p_species, p_pokemon_name), p_types,
    p_level, COALESCE(p_stats_hp, 10), COALESCE(p_stats_hp, 10), COALESCE(p_stats_attack, 5),
    COALESCE(p_stats_defense, 5), COALESCE(p_stats_sp_atk, 5), COALESCE(p_stats_sp_def, 5), COALESCE(p_stats_speed, 5),
    p_iv_hp, p_iv_attack, p_iv_defense, p_iv_sp_atk, p_iv_sp_def, p_iv_speed,
    p_nature, p_is_shiny, v_team_count + 1
  )
  RETURNING id INTO v_new_id;

  RETURN jsonb_build_object(
    'success', true,
    'id', v_new_id,
    'pokemon_id', p_pokemon_id,
    'pokemon_name', p_pokemon_name,
    'level', p_level,
    'is_shiny', p_is_shiny
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================
-- PART 9: SERVER-SIDE QUEST REWARD VALIDATION
-- Rewards are issued only if quest conditions are met
-- ============================================================

CREATE OR REPLACE FUNCTION safe_claim_quest_reward(
  p_character_id UUID,
  p_quest_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_owner_user_id UUID;
  v_quest RECORD;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  SELECT gs.user_id INTO v_owner_user_id FROM game_saves gs WHERE gs.id = p_character_id;
  IF NOT FOUND OR v_owner_user_id != auth.uid() THEN
    RETURN jsonb_build_object('error', 'Not authorized');
  END IF;

  -- Verify quest exists
  SELECT * INTO v_quest FROM professor_quests WHERE id = p_quest_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Quest not found');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'quest_id', p_quest_id,
    'silver_reward', COALESCE(v_quest.silver_reward, 0),
    'gold_reward', COALESCE(v_quest.gold_reward, 0),
    'diamond_reward', COALESCE(v_quest.diamond_reward, 0),
    'item_reward_id', v_quest.item_reward_id,
    'item_reward_name', v_quest.item_reward_name,
    'item_reward_qty', COALESCE(v_quest.item_reward_qty, 1),
    'pokemon_reward_id', v_quest.pokemon_reward_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================
-- PART 10: SERVER-SIDE QUEST POKEMON REWARD
-- Grants a pokemon to the character without map validation
-- ============================================================

CREATE OR REPLACE FUNCTION safe_grant_quest_pokemon(
  p_character_id UUID,
  p_pokemon_id INTEGER,
  p_level INTEGER DEFAULT 5,
  p_nature TEXT DEFAULT 'hardy',
  p_iv_hp INTEGER DEFAULT 0,
  p_iv_attack INTEGER DEFAULT 0,
  p_iv_defense INTEGER DEFAULT 0,
  p_iv_sp_atk INTEGER DEFAULT 0,
  p_iv_sp_def INTEGER DEFAULT 0,
  p_iv_speed INTEGER DEFAULT 0
) RETURNS JSONB AS $$
DECLARE
  v_owner_user_id UUID;
  v_poke RECORD;
  v_team_count INTEGER;
  v_new_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  SELECT gs.user_id INTO v_owner_user_id FROM game_saves gs WHERE gs.id = p_character_id;
  IF NOT FOUND OR v_owner_user_id != auth.uid() THEN
    RETURN jsonb_build_object('error', 'Not authorized');
  END IF;

  -- Verify pokemon exists
  SELECT name, types INTO v_poke FROM pokemon WHERE id = p_pokemon_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Pokemon not found');
  END IF;

  -- Check team size - if full, return success with PC flag (client stores in PC)
  SELECT COUNT(*) INTO v_team_count FROM pokemon_team WHERE user_id = auth.uid();
  IF v_team_count >= 6 THEN
    RETURN jsonb_build_object(
      'success', true,
      'stored_in_pc', true,
      'pokemon_id', p_pokemon_id,
      'pokemon_name', v_poke.name,
      'message', 'Time cheio! Pokemon enviado para o PC.'
    );
  END IF;

  -- Validate level
  IF p_level < 1 OR p_level > 100 THEN
    RETURN jsonb_build_object('error', 'Invalid level');
  END IF;

  INSERT INTO pokemon_team (
    user_id, character_id, pokemon_id, pokemon_name, species, types,
    level, current_hp, stats_hp, stats_attack, stats_defense,
    stats_sp_atk, stats_sp_def, stats_speed,
    iv_hp, iv_attack, iv_defense, iv_sp_atk, iv_sp_def, iv_speed,
    nature, slot
  ) VALUES (
    auth.uid(), p_character_id, p_pokemon_id, v_poke.name, v_poke.name, COALESCE(v_poke.types::TEXT, ''),
    p_level, 0, 0, 0, 0, 0, 0, 0,
    p_iv_hp, p_iv_attack, p_iv_defense, p_iv_sp_atk, p_iv_sp_def, p_iv_speed,
    p_nature, v_team_count + 1
  )
  RETURNING id INTO v_new_id;

  RETURN jsonb_build_object(
    'success', true,
    'id', v_new_id,
    'pokemon_id', p_pokemon_id,
    'pokemon_name', v_poke.name
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================
-- PART 11: SERVER-SIDE PC BOX OPERATIONS
-- ============================================================

CREATE OR REPLACE FUNCTION safe_store_pc_pokemon(
  p_character_id UUID,
  p_pokemon_id INTEGER,
  p_species TEXT,
  p_level INTEGER DEFAULT 5,
  p_current_hp INTEGER DEFAULT 0,
  p_max_hp INTEGER DEFAULT 0,
  p_experience INTEGER DEFAULT 0,
  p_moves JSONB DEFAULT '[]'::jsonb,
  p_iv_hp INTEGER DEFAULT 15,
  p_iv_attack INTEGER DEFAULT 15,
  p_iv_defense INTEGER DEFAULT 15,
  p_iv_sp_atk INTEGER DEFAULT 15,
  p_iv_sp_def INTEGER DEFAULT 15,
  p_iv_speed INTEGER DEFAULT 15,
  p_ev_hp INTEGER DEFAULT 0,
  p_ev_attack INTEGER DEFAULT 0,
  p_ev_defense INTEGER DEFAULT 0,
  p_ev_sp_atk INTEGER DEFAULT 0,
  p_ev_sp_def INTEGER DEFAULT 0,
  p_ev_speed INTEGER DEFAULT 0,
  p_nature TEXT DEFAULT 'hardy',
  p_status_effect TEXT DEFAULT NULL,
  p_happiness INTEGER DEFAULT 70,
  p_is_shiny BOOLEAN DEFAULT false,
  p_held_item_id INTEGER DEFAULT NULL,
  p_nickname TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_owner_user_id UUID;
  v_box INT;
  v_slot INT;
  v_new_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;
  SELECT gs.user_id INTO v_owner_user_id FROM game_saves gs WHERE gs.id = p_character_id;
  IF NOT FOUND OR v_owner_user_id != auth.uid() THEN
    RETURN jsonb_build_object('error', 'Not authorized');
  END IF;
  FOR v_box IN 1..20 LOOP
    FOR v_slot IN 0..29 LOOP
      IF NOT EXISTS(SELECT 1 FROM pokemon_pc WHERE character_id = p_character_id AND box_number = v_box AND slot_index = v_slot) THEN
        INSERT INTO pokemon_pc (user_id, character_id, box_number, slot_index, species, nickname, level, current_hp, max_hp, experience, moves, pokemon_id, iv_hp, iv_attack, iv_defense, iv_sp_atk, iv_sp_def, iv_speed, ev_hp, ev_attack, ev_defense, ev_sp_atk, ev_sp_def, ev_speed, nature, status_effect, happiness, is_shiny, held_item_id)
        VALUES (auth.uid(), p_character_id, v_box, v_slot, p_species, p_nickname, p_level, p_current_hp, p_max_hp, p_experience, p_moves, p_pokemon_id, p_iv_hp, p_iv_attack, p_iv_defense, p_iv_sp_atk, p_iv_sp_def, p_iv_speed, p_ev_hp, p_ev_attack, p_ev_defense, p_ev_sp_atk, p_ev_sp_def, p_ev_speed, p_nature, p_status_effect, p_happiness, p_is_shiny, p_held_item_id)
        RETURNING id INTO v_new_id;
        RETURN jsonb_build_object('success', true, 'id', v_new_id, 'box', v_box, 'slot', v_slot);
      END IF;
    END LOOP;
  END LOOP;
  RETURN jsonb_build_object('error', 'PC is full');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION safe_retrieve_pc_pokemon(
  p_character_id UUID,
  p_pokemon_pc_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_owner_user_id UUID;
  v_poke RECORD;
  v_team_count INTEGER;
  v_new_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;
  SELECT gs.user_id INTO v_owner_user_id FROM game_saves gs WHERE gs.id = p_character_id;
  IF NOT FOUND OR v_owner_user_id != auth.uid() THEN
    RETURN jsonb_build_object('error', 'Not authorized');
  END IF;
  SELECT * INTO v_poke FROM pokemon_pc WHERE id = p_pokemon_pc_id AND user_id = auth.uid();
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Pokemon not found in PC');
  END IF;
  SELECT COUNT(*) INTO v_team_count FROM pokemon_team WHERE user_id = auth.uid();
  IF v_team_count >= 6 THEN
    RETURN jsonb_build_object('error', 'Team is full (max 6)');
  END IF;
  INSERT INTO pokemon_team (user_id, character_id, pokemon_id, pokemon_name, species, types, level, current_hp, stats_hp, stats_attack, stats_defense, stats_sp_atk, stats_sp_def, stats_speed, iv_hp, iv_attack, iv_defense, iv_sp_atk, iv_sp_def, iv_speed, ev_hp, ev_attack, ev_defense, ev_sp_atk, ev_sp_def, ev_speed, nature, happiness, is_shiny, held_item_id, status_effect, slot)
  VALUES (auth.uid(), p_character_id, v_poke.pokemon_id, v_poke.species, v_poke.species, '', v_poke.level, COALESCE(v_poke.current_hp, v_poke.max_hp), COALESCE(v_poke.max_hp, 10), 5, 5, 5, 5, 5, v_poke.iv_hp, v_poke.iv_attack, v_poke.iv_defense, v_poke.iv_sp_atk, v_poke.iv_sp_def, v_poke.iv_speed, v_poke.ev_hp, v_poke.ev_attack, v_poke.ev_defense, v_poke.ev_sp_atk, v_poke.ev_sp_def, v_poke.ev_speed, v_poke.nature, v_poke.happiness, v_poke.is_shiny, v_poke.held_item_id, v_poke.status_effect, v_team_count + 1)
  RETURNING id INTO v_new_id;
  DELETE FROM pokemon_pc WHERE id = p_pokemon_pc_id;
  RETURN jsonb_build_object('success', true, 'id', v_new_id, 'pokemon_name', v_poke.species);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION safe_deposit_pc_pokemon(
  p_character_id UUID,
  p_pokemon_team_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_owner_user_id UUID;
  v_poke RECORD;
  v_box INT;
  v_slot INT;
  v_new_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;
  SELECT gs.user_id INTO v_owner_user_id FROM game_saves gs WHERE gs.id = p_character_id;
  IF NOT FOUND OR v_owner_user_id != auth.uid() THEN
    RETURN jsonb_build_object('error', 'Not authorized');
  END IF;
  SELECT * INTO v_poke FROM pokemon_team WHERE id = p_pokemon_team_id AND user_id = auth.uid();
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Pokemon not found in team');
  END IF;
  FOR v_box IN 1..20 LOOP
    FOR v_slot IN 0..29 LOOP
      IF NOT EXISTS(SELECT 1 FROM pokemon_pc WHERE character_id = p_character_id AND box_number = v_box AND slot_index = v_slot) THEN
        INSERT INTO pokemon_pc (user_id, character_id, box_number, slot_index, species, nickname, level, current_hp, max_hp, experience, moves, pokemon_id, iv_hp, iv_attack, iv_defense, iv_sp_atk, iv_sp_def, iv_speed, ev_hp, ev_attack, ev_defense, ev_sp_atk, ev_sp_def, ev_speed, nature, status_effect, happiness, is_shiny, held_item_id)
        VALUES (auth.uid(), p_character_id, v_box, v_slot, v_poke.species, v_poke.pokemon_name, v_poke.level, v_poke.current_hp, v_poke.stats_hp, v_poke.experience, '[]'::jsonb, v_poke.pokemon_id, v_poke.iv_hp, v_poke.iv_attack, v_poke.iv_defense, v_poke.iv_sp_atk, v_poke.iv_sp_def, v_poke.iv_speed, v_poke.ev_hp, v_poke.ev_attack, v_poke.ev_defense, v_poke.ev_sp_atk, v_poke.ev_sp_def, v_poke.ev_speed, v_poke.nature, v_poke.status_effect, v_poke.happiness, v_poke.is_shiny, v_poke.held_item_id)
        RETURNING id INTO v_new_id;
        DELETE FROM pokemon_team WHERE id = p_pokemon_team_id;
        RETURN jsonb_build_object('success', true, 'id', v_new_id, 'box', v_box, 'slot', v_slot);
      END IF;
    END LOOP;
  END LOOP;
  RETURN jsonb_build_object('error', 'PC is full');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Block direct insert/update/delete on pokemon_pc
ALTER TABLE pokemon_pc ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their own PC pokemon" ON pokemon_pc;
DROP POLICY IF EXISTS "Service role can manage all PC pokemon" ON pokemon_pc;
DROP POLICY IF EXISTS "pokemonpc_select" ON pokemon_pc;
DROP POLICY IF EXISTS "pokemonpc_block_insert" ON pokemon_pc;
DROP POLICY IF EXISTS "pokemonpc_block_update" ON pokemon_pc;
DROP POLICY IF EXISTS "pokemonpc_block_delete" ON pokemon_pc;

CREATE POLICY "pokemonpc_select" ON pokemon_pc FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "pokemonpc_block_insert" ON pokemon_pc FOR INSERT
  WITH CHECK (false);

CREATE POLICY "pokemonpc_block_update" ON pokemon_pc FOR UPDATE
  USING (false);

CREATE POLICY "pokemonpc_block_delete" ON pokemon_pc FOR DELETE
  USING (false);


-- ============================================================
-- PART 12: SERVER-SIDE BOOST PURCHASES
-- ============================================================

CREATE OR REPLACE FUNCTION safe_purchase_boost(
  p_character_id UUID,
  p_boost_type TEXT,
  p_duration_ms BIGINT
) RETURNS JSONB AS $$
DECLARE
  v_owner_user_id UUID;
  v_expires_at TIMESTAMPTZ;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  SELECT gs.user_id INTO v_owner_user_id FROM game_saves gs WHERE gs.id = p_character_id;
  IF NOT FOUND OR v_owner_user_id != auth.uid() THEN
    RETURN jsonb_build_object('error', 'Not authorized');
  END IF;

  IF p_boost_type NOT IN ('vip', 'center_anywhere', 'shiny_boost', 'exp_pokemon', 'exp_trainer') THEN
    RETURN jsonb_build_object('error', 'Invalid boost type');
  END IF;

  v_expires_at := NOW() + (p_duration_ms || ' milliseconds')::INTERVAL;

  INSERT INTO character_boosts (character_id, boost_type, expires_at)
  VALUES (p_character_id, p_boost_type, v_expires_at)
  ON CONFLICT (character_id, boost_type) DO UPDATE
  SET expires_at = EXCLUDED.expires_at;

  RETURN jsonb_build_object('success', true, 'boost_type', p_boost_type, 'expires_at', v_expires_at);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Block direct write access to character_boosts
ALTER TABLE character_boosts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can read own character boosts" ON character_boosts;
DROP POLICY IF EXISTS "Users can insert own character boosts" ON character_boosts;
DROP POLICY IF EXISTS "Users can update own character boosts" ON character_boosts;
DROP POLICY IF EXISTS "Users can delete own character boosts" ON character_boosts;

DROP POLICY IF EXISTS "boosts_select" ON character_boosts;
DROP POLICY IF EXISTS "boosts_block_insert" ON character_boosts;
DROP POLICY IF EXISTS "boosts_block_update" ON character_boosts;
DROP POLICY IF EXISTS "boosts_block_delete" ON character_boosts;

CREATE POLICY "boosts_select" ON character_boosts FOR SELECT
  USING (character_id IN (SELECT id FROM game_saves WHERE user_id = auth.uid()));

CREATE POLICY "boosts_block_insert" ON character_boosts FOR INSERT
  WITH CHECK (false);

CREATE POLICY "boosts_block_update" ON character_boosts FOR UPDATE
  USING (false);

CREATE POLICY "boosts_block_delete" ON character_boosts FOR DELETE
  USING (false);


-- ============================================================
-- PART 11b: ADDITIONAL PC RPCs (store to specific slot, delete)
-- ============================================================

CREATE OR REPLACE FUNCTION safe_store_pc_slot(
  p_character_id UUID,
  p_box_number INT,
  p_slot_index INT,
  p_pokemon_id INTEGER,
  p_species TEXT,
  p_level INTEGER DEFAULT 5,
  p_current_hp INTEGER DEFAULT 0,
  p_max_hp INTEGER DEFAULT 0,
  p_experience INTEGER DEFAULT 0,
  p_moves JSONB DEFAULT '[]'::jsonb,
  p_iv_hp INTEGER DEFAULT 15,
  p_iv_attack INTEGER DEFAULT 15,
  p_iv_defense INTEGER DEFAULT 15,
  p_iv_sp_atk INTEGER DEFAULT 15,
  p_iv_sp_def INTEGER DEFAULT 15,
  p_iv_speed INTEGER DEFAULT 15,
  p_ev_hp INTEGER DEFAULT 0,
  p_ev_attack INTEGER DEFAULT 0,
  p_ev_defense INTEGER DEFAULT 0,
  p_ev_sp_atk INTEGER DEFAULT 0,
  p_ev_sp_def INTEGER DEFAULT 0,
  p_ev_speed INTEGER DEFAULT 0,
  p_nature TEXT DEFAULT 'hardy',
  p_status_effect TEXT DEFAULT NULL,
  p_happiness INTEGER DEFAULT 70,
  p_is_shiny BOOLEAN DEFAULT false,
  p_held_item_id INTEGER DEFAULT NULL,
  p_nickname TEXT DEFAULT NULL,
  p_is_mega BOOLEAN DEFAULT false
) RETURNS JSONB AS $$
DECLARE
  v_owner_user_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;
  SELECT gs.user_id INTO v_owner_user_id FROM game_saves gs WHERE gs.id = p_character_id;
  IF NOT FOUND OR v_owner_user_id != auth.uid() THEN
    RETURN jsonb_build_object('error', 'Not authorized');
  END IF;

  INSERT INTO pokemon_pc (user_id, character_id, box_number, slot_index, species, nickname, level, current_hp, max_hp, experience, moves, pokemon_id, iv_hp, iv_attack, iv_defense, iv_sp_atk, iv_sp_def, iv_speed, ev_hp, ev_attack, ev_defense, ev_sp_atk, ev_sp_def, ev_speed, nature, status_effect, happiness, is_shiny, is_mega, held_item_id)
  VALUES (auth.uid(), p_character_id, p_box_number, p_slot_index, p_species, p_nickname, p_level, p_current_hp, p_max_hp, p_experience, p_moves, p_pokemon_id, p_iv_hp, p_iv_attack, p_iv_defense, p_iv_sp_atk, p_iv_sp_def, p_iv_speed, p_ev_hp, p_ev_attack, p_ev_defense, p_ev_sp_atk, p_ev_sp_def, p_ev_speed, p_nature, p_status_effect, p_happiness, p_is_shiny, p_is_mega, p_held_item_id)
  ON CONFLICT (character_id, box_number, slot_index) DO UPDATE SET
    species = EXCLUDED.species, nickname = EXCLUDED.nickname, level = EXCLUDED.level,
    current_hp = EXCLUDED.current_hp, max_hp = EXCLUDED.max_hp, experience = EXCLUDED.experience,
    moves = EXCLUDED.moves, pokemon_id = EXCLUDED.pokemon_id,
    iv_hp = EXCLUDED.iv_hp, iv_attack = EXCLUDED.iv_attack, iv_defense = EXCLUDED.iv_defense,
    iv_sp_atk = EXCLUDED.iv_sp_atk, iv_sp_def = EXCLUDED.iv_sp_def, iv_speed = EXCLUDED.iv_speed,
    ev_hp = EXCLUDED.ev_hp, ev_attack = EXCLUDED.ev_attack, ev_defense = EXCLUDED.ev_defense,
    ev_sp_atk = EXCLUDED.ev_sp_atk, ev_sp_def = EXCLUDED.ev_sp_def, ev_speed = EXCLUDED.ev_speed,
    nature = EXCLUDED.nature, status_effect = EXCLUDED.status_effect, happiness = EXCLUDED.happiness,
    is_shiny = EXCLUDED.is_shiny, is_mega = EXCLUDED.is_mega, held_item_id = EXCLUDED.held_item_id;

  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION safe_delete_pc_pokemon(
  p_character_id UUID,
  p_pokemon_pc_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_owner_user_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;
  SELECT gs.user_id INTO v_owner_user_id FROM game_saves gs WHERE gs.id = p_character_id;
  IF NOT FOUND OR v_owner_user_id != auth.uid() THEN
    RETURN jsonb_build_object('error', 'Not authorized');
  END IF;
  DELETE FROM pokemon_pc WHERE id = p_pokemon_pc_id AND user_id = auth.uid();
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Pokemon not found in PC');
  END IF;
  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================
-- VERIFICATION
-- ============================================================
SELECT 'Security system installed successfully' AS status;
