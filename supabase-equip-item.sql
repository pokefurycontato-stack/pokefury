-- ============================================================
-- Equipar item em pokemon (com suporte a múltiplos itens iguais)
-- ============================================================
CREATE OR REPLACE FUNCTION safe_equip_item(
  p_character_id UUID,
  p_pokemon_id UUID,
  p_item_id INTEGER
) RETURNS JSONB AS $$
DECLARE
  v_user_id UUID;
  v_qty INTEGER := 0;
  v_other_count INTEGER := 0;
  v_old_name TEXT;
  v_old_id UUID;
  v_new_name TEXT;
  v_new_id UUID;
  v_moved BOOLEAN := false;
  v_target_had_item BOOLEAN := false;
  v_target_item INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('error', 'Not authenticated'); END IF;
  SELECT gs.user_id INTO v_user_id FROM game_saves gs WHERE gs.id = p_character_id;
  IF NOT FOUND OR v_user_id != auth.uid() THEN RETURN jsonb_build_object('error', 'Not authorized'); END IF;

  -- O que o pokemon alvo já está segurado? (se já estiver com ESTE item => desequipa)
  SELECT held_item_id INTO v_target_item FROM pokemon_team
  WHERE id = p_pokemon_id AND character_id = p_character_id;

  IF v_target_item IS NOT NULL AND v_target_item = p_item_id THEN
    -- Já está com este item equipado => desequipa (retorna ao inventário)
    UPDATE pokemon_team SET held_item_id = NULL WHERE id = p_pokemon_id AND character_id = p_character_id;
    RETURN jsonb_build_object(
      'success', true,
      'unequipped', true,
      'target_id', p_pokemon_id,
      'swapped_from', NULL,
      'swapped_from_id', NULL
    );
  END IF;

  -- Quantidade deste item no inventário
  SELECT COALESCE(quantity, 0) INTO v_qty FROM player_inventory
  WHERE character_id = p_character_id AND item_id = p_item_id;

  -- Quantos OUTROS pokemons já têm este item equipado
  SELECT COUNT(*) INTO v_other_count FROM pokemon_team
  WHERE character_id = p_character_id AND held_item_id = p_item_id AND id != p_pokemon_id;

  -- Se não tem item suficiente, move (remove de outro pokemon)
  IF v_other_count >= v_qty AND v_qty > 0 THEN
    SELECT species, id INTO v_old_name, v_old_id FROM pokemon_team
    WHERE character_id = p_character_id AND held_item_id = p_item_id AND id != p_pokemon_id
    ORDER BY slot LIMIT 1;

    UPDATE pokemon_team SET held_item_id = NULL
    WHERE id = (
      SELECT id FROM pokemon_team
      WHERE character_id = p_character_id AND held_item_id = p_item_id AND id != p_pokemon_id
      ORDER BY slot LIMIT 1
    );
    v_moved := true;
  END IF;

  -- Equipa no pokemon alvo
  UPDATE pokemon_team SET held_item_id = p_item_id
  WHERE id = p_pokemon_id AND character_id = p_character_id;

  SELECT species, id INTO v_new_name, v_new_id FROM pokemon_team WHERE id = p_pokemon_id;

  RETURN jsonb_build_object(
    'success', true,
    'unequipped', false,
    'target', v_new_name,
    'target_id', v_new_id,
    'swapped_from', CASE WHEN v_moved THEN v_old_name ELSE NULL END,
    'swapped_from_id', CASE WHEN v_moved THEN v_old_id ELSE NULL END
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- Desequipar item (o item volta ao inventário)
-- ============================================================
CREATE OR REPLACE FUNCTION safe_unequip_item(
  p_character_id UUID,
  p_pokemon_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_user_id UUID;
  v_target_item INTEGER;
  v_was_held BOOLEAN := false;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('error', 'Not authenticated'); END IF;
  SELECT gs.user_id INTO v_user_id FROM game_saves gs WHERE gs.id = p_character_id;
  IF NOT FOUND OR v_user_id != auth.uid() THEN RETURN jsonb_build_object('error', 'Not authorized'); END IF;

  SELECT held_item_id INTO v_target_item FROM pokemon_team
  WHERE id = p_pokemon_id AND character_id = p_character_id;

  IF v_target_item IS NOT NULL THEN
    UPDATE pokemon_team SET held_item_id = NULL WHERE id = p_pokemon_id AND character_id = p_character_id;
    v_was_held := true;
  END IF;

  RETURN jsonb_build_object('success', true, 'was_held', v_was_held);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

SELECT 'Equip item system installed' AS status;
