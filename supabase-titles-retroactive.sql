-- ============================================================
-- TITLE SYSTEM - Verificação retroativa (v2)
-- Concede títulos de lendários, megas, coleção e shiny
-- ============================================================

CREATE OR REPLACE FUNCTION sync_titles_retroactive(p_character_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_user_id UUID;
  v_total INTEGER;
  v_shiny INTEGER;
  v_awarded JSONB DEFAULT '[]'::jsonb;
  v_poke RECORD;
  v_title RECORD;
  v_var TEXT;
  v_base INTEGER;
  v_base_name TEXT;
  v_tid TEXT;
  v_tname TEXT;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('error', 'Not authenticated'); END IF;
  SELECT gs.user_id INTO v_user_id FROM game_saves gs WHERE gs.id = p_character_id;
  IF NOT FOUND OR v_user_id != auth.uid() THEN RETURN jsonb_build_object('error', 'Not authorized'); END IF;

  -- Correção: títulos de lendário gravados sem o prefixo "Mestre de "
  UPDATE character_titles SET title_name = 'Mestre de ' || title_name
  WHERE character_id = p_character_id
    AND title_id LIKE 'master_%'
    AND title_id NOT LIKE 'megamaster_%'
    AND title_name NOT LIKE 'Mestre de %';

  SELECT COUNT(*) INTO v_total FROM (
    SELECT id FROM pokemon_team WHERE character_id = p_character_id
    UNION ALL
    SELECT id FROM pokemon_pc WHERE character_id = p_character_id
  ) t;

  SELECT COUNT(*) INTO v_shiny FROM (
    SELECT id FROM pokemon_team WHERE character_id = p_character_id AND is_shiny = true
    UNION ALL
    SELECT id FROM pokemon_pc WHERE character_id = p_character_id AND is_shiny = true
  ) s;

  INSERT INTO character_stats (character_id, catches, shiny_catches)
  VALUES (p_character_id, COALESCE(v_total,0), COALESCE(v_shiny,0))
  ON CONFLICT (character_id) DO UPDATE SET
    catches = GREATEST(character_stats.catches, EXCLUDED.catches),
    shiny_catches = GREATEST(character_stats.shiny_catches, EXCLUDED.shiny_catches);

  FOR v_title IN SELECT * FROM titles WHERE category = 'catches' AND threshold <= COALESCE(v_total,0) ORDER BY threshold LOOP
    IF NOT EXISTS(SELECT 1 FROM character_titles WHERE character_id = p_character_id AND title_id = v_title.id) THEN
      INSERT INTO character_titles (character_id, title_id, title_name) VALUES (p_character_id, v_title.id, v_title.name);
      v_awarded := v_awarded || jsonb_build_object('id', v_title.id, 'name', v_title.name);
    END IF;
  END LOOP;

  FOR v_title IN SELECT * FROM titles WHERE category = 'shiny' AND threshold <= COALESCE(v_shiny,0) ORDER BY threshold LOOP
    IF NOT EXISTS(SELECT 1 FROM character_titles WHERE character_id = p_character_id AND title_id = v_title.id) THEN
      INSERT INTO character_titles (character_id, title_id, title_name) VALUES (p_character_id, v_title.id, v_title.name);
      v_awarded := v_awarded || jsonb_build_object('id', v_title.id, 'name', v_title.name);
    END IF;
  END LOOP;

  -- Lendários e Megas (percorre todos os pokemons do time + PC)
  FOR v_poke IN
    SELECT pokemon_id FROM pokemon_team WHERE character_id = p_character_id AND pokemon_id IS NOT NULL
    UNION
    SELECT pokemon_id FROM pokemon_pc WHERE character_id = p_character_id AND pokemon_id IS NOT NULL
  LOOP
    SELECT variant, base_pokemon_id INTO v_var, v_base FROM pokemon WHERE id = v_poke.pokemon_id;

    -- Título de lendário (o próprio pokemon OU o base, se for mega de lendário)
    IF v_var = 'mega' AND v_base IS NOT NULL THEN
      -- É um Mega: título "Mestre de Mega {base}"
      SELECT name INTO v_base_name FROM pokemon WHERE id = v_base;
      IF v_base_name IS NOT NULL THEN
        v_tid := 'megamaster_' || v_poke.pokemon_id::text;
        v_tname := 'Mestre de Mega ' || v_base_name;
        IF NOT EXISTS(SELECT 1 FROM character_titles WHERE character_id = p_character_id AND title_id = v_tid) THEN
          INSERT INTO character_titles (character_id, title_id, title_name) VALUES (p_character_id, v_tid, v_tname);
          v_awarded := v_awarded || jsonb_build_object('id', v_tid, 'name', v_tname);
        END IF;
      END IF;
      -- Se o base for lendário, também dá "Mestre de {base}"
      IF v_base IN (144,145,146,150,151,243,244,245,249,250,251,377,378,379,380,381,382,383,384,385,386,480,481,482,483,484,485,486,487,488,489,490,491,492,493,494,638,639,640,641,642,643,644,645,646,647,648,649,716,717,718,719,720,721,772,773,785,786,787,788,789,790,791,792,800,801,802,803,804,805,806,807,808,809,888,889,890,891,892,894,895,896,897,898,905,1001,1002,1003,1004,1007,1008,1009,1010,1014,1015,1016,1017,1020,1021,1022,1023,1024,1025) THEN
        v_tid := 'master_' || v_base::text;
        v_tname := 'Mestre de ' || v_base_name;
        IF NOT EXISTS(SELECT 1 FROM character_titles WHERE character_id = p_character_id AND title_id = v_tid) THEN
          INSERT INTO character_titles (character_id, title_id, title_name) VALUES (p_character_id, v_tid, v_tname);
          v_awarded := v_awarded || jsonb_build_object('id', v_tid, 'name', v_tname);
        END IF;
      END IF;
    ELSIF v_poke.pokemon_id IN (144,145,146,150,151,243,244,245,249,250,251,377,378,379,380,381,382,383,384,385,386,480,481,482,483,484,485,486,487,488,489,490,491,492,493,494,638,639,640,641,642,643,644,645,646,647,648,649,716,717,718,719,720,721,772,773,785,786,787,788,789,790,791,792,800,801,802,803,804,805,806,807,808,809,888,889,890,891,892,894,895,896,897,898,905,1001,1002,1003,1004,1007,1008,1009,1010,1014,1015,1016,1017,1020,1021,1022,1023,1024,1025) THEN
      -- É um lendário normal: "Mestre de {nome}"
      SELECT name INTO v_tname FROM pokemon WHERE id = v_poke.pokemon_id;
      v_tid := 'master_' || v_poke.pokemon_id::text;
      v_tname := 'Mestre de ' || v_tname;
      IF NOT EXISTS(SELECT 1 FROM character_titles WHERE character_id = p_character_id AND title_id = v_tid) THEN
        INSERT INTO character_titles (character_id, title_id, title_name) VALUES (p_character_id, v_tid, v_tname);
        v_awarded := v_awarded || jsonb_build_object('id', v_tid, 'name', v_tname);
      END IF;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'total', COALESCE(v_total,0), 'shiny', COALESCE(v_shiny,0), 'awarded', v_awarded);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

SELECT 'Retroactive title check v2 installed' AS status;
