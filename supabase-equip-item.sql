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
  v_new_name TEXT;
  v_moved BOOLEAN := false;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('error', 'Not authenticated'); END IF;
  SELECT gs.user_id INTO v_user_id FROM game_saves gs WHERE gs.id = p_character_id;
  IF NOT FOUND OR v_user_id != auth.uid() THEN RETURN jsonb_build_object('error', 'Not authorized'); END IF;

  -- Quantidade deste item no inventário
  SELECT COALESCE(quantity, 0) INTO v_qty FROM player_inventory
  WHERE character_id = p_character_id AND item_id = p_item_id;

  -- Quantos OUTROS pokemons já têm este item equipado
  SELECT COUNT(*) INTO v_other_count FROM pokemon_team
  WHERE character_id = p_character_id AND held_item_id = p_item_id AND id != p_pokemon_id;

  -- Se não tem item suficiente, move (remove de outro pokemon)
  IF v_other_count >= v_qty AND v_qty > 0 THEN
    SELECT species INTO v_old_name FROM pokemon_team
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

  SELECT species INTO v_new_name FROM pokemon_team WHERE id = p_pokemon_id;

  RETURN jsonb_build_object(
    'success', true,
    'swapped_from', CASE WHEN v_moved THEN v_old_name ELSE NULL END,
    'target', v_new_name
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

SELECT 'Equip item system installed' AS status;
