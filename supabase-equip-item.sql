-- ============================================================
-- Equipar item em pokemon (com troca automática)
-- ============================================================
CREATE OR REPLACE FUNCTION safe_equip_item(
  p_character_id UUID,
  p_pokemon_id UUID,
  p_item_id INTEGER
) RETURNS JSONB AS $$
DECLARE
  v_user_id UUID;
  v_old_name TEXT;
  v_new_name TEXT;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('error', 'Not authenticated'); END IF;
  SELECT gs.user_id INTO v_user_id FROM game_saves gs WHERE gs.id = p_character_id;
  IF NOT FOUND OR v_user_id != auth.uid() THEN RETURN jsonb_build_object('error', 'Not authorized'); END IF;

  -- Verifica se o item já está equipado em outro pokemon do time
  SELECT COALESCE(pokemon_name, species) INTO v_old_name FROM pokemon_team
  WHERE character_id = p_character_id AND held_item_id = p_item_id AND id != p_pokemon_id
  LIMIT 1;

  -- Remove o item do pokemon antigo (se houver)
  IF v_old_name IS NOT NULL THEN
    UPDATE pokemon_team SET held_item_id = NULL
    WHERE character_id = p_character_id AND held_item_id = p_item_id AND id != p_pokemon_id;
  END IF;

  -- Equipa no pokemon alvo
  UPDATE pokemon_team SET held_item_id = p_item_id
  WHERE id = p_pokemon_id AND character_id = p_character_id;

  -- Pega o nome do pokemon alvo
  SELECT COALESCE(pokemon_name, species) INTO v_new_name FROM pokemon_team WHERE id = p_pokemon_id;

  RETURN jsonb_build_object('success', true, 'swapped_from', v_old_name, 'target', v_new_name);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

SELECT 'Equip item system installed' AS status;
