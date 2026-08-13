-- ============================================================
-- TITLE SYSTEM - Verificação retroativa
-- Concede títulos que o jogador já merece (lendários, coleção, shiny)
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
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('error', 'Not authenticated'); END IF;
  SELECT gs.user_id INTO v_user_id FROM game_saves gs WHERE gs.id = p_character_id;
  IF NOT FOUND OR v_user_id != auth.uid() THEN RETURN jsonb_build_object('error', 'Not authorized'); END IF;

  -- Contar pokemons do time + PC
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

  -- Atualizar base dos contadores (sem reduzir o que já foi contado)
  INSERT INTO character_stats (character_id, catches, shiny_catches)
  VALUES (p_character_id, COALESCE(v_total,0), COALESCE(v_shiny,0))
  ON CONFLICT (character_id) DO UPDATE SET
    catches = GREATEST(character_stats.catches, EXCLUDED.catches),
    shiny_catches = GREATEST(character_stats.shiny_catches, EXCLUDED.shiny_catches);

  -- Títulos por coleção
  FOR v_title IN SELECT * FROM titles WHERE category = 'catches' AND threshold <= COALESCE(v_total,0) ORDER BY threshold LOOP
    IF NOT EXISTS(SELECT 1 FROM character_titles WHERE character_id = p_character_id AND title_id = v_title.id) THEN
      INSERT INTO character_titles (character_id, title_id, title_name) VALUES (p_character_id, v_title.id, v_title.name);
      v_awarded := v_awarded || jsonb_build_object('id', v_title.id, 'name', v_title.name);
    END IF;
  END LOOP;

  -- Títulos por shiny
  FOR v_title IN SELECT * FROM titles WHERE category = 'shiny' AND threshold <= COALESCE(v_shiny,0) ORDER BY threshold LOOP
    IF NOT EXISTS(SELECT 1 FROM character_titles WHERE character_id = p_character_id AND title_id = v_title.id) THEN
      INSERT INTO character_titles (character_id, title_id, title_name) VALUES (p_character_id, v_title.id, v_title.name);
      v_awarded := v_awarded || jsonb_build_object('id', v_title.id, 'name', v_title.name);
    END IF;
  END LOOP;

  -- Títulos de lendários (Mestre de X) — detectar lendários já capturados
  FOR v_poke IN
    SELECT DISTINCT pt.pokemon_id, p.name
    FROM pokemon_team pt JOIN pokemon p ON p.id = pt.pokemon_id
    WHERE pt.character_id = p_character_id AND pt.pokemon_id IN (
      144,145,146,150,151,243,244,245,249,250,251,377,378,379,380,381,382,383,384,385,386,
      480,481,482,483,484,485,486,487,488,491,493,494,638,639,640,641,642,643,644,645,646,647,648,649,
      716,717,718,719,720,721,772,773,785,786,787,788,789,790,791,792,800,801,802,888,889,890
    )
    UNION
    SELECT DISTINCT pc.pokemon_id, p.name
    FROM pokemon_pc pc JOIN pokemon p ON p.id = pc.pokemon_id
    WHERE pc.character_id = p_character_id AND pc.pokemon_id IN (
      144,145,146,150,151,243,244,245,249,250,251,377,378,379,380,381,382,383,384,385,386,
      480,481,482,483,484,485,486,487,488,491,493,494,638,639,640,641,642,643,644,645,646,647,648,649,
      716,717,718,719,720,721,772,773,785,786,787,788,789,790,791,792,800,801,802,888,889,890
    )
  LOOP
    DECLARE
      v_tid TEXT := 'master_' || v_poke.pokemon_id::text;
      v_tname TEXT := 'Mestre de ' || v_poke.name;
    BEGIN
      IF NOT EXISTS(SELECT 1 FROM character_titles WHERE character_id = p_character_id AND title_id = v_tid) THEN
        INSERT INTO character_titles (character_id, title_id, title_name) VALUES (p_character_id, v_tid, v_tname);
        v_awarded := v_awarded || jsonb_build_object('id', v_tid, 'name', v_tname);
      END IF;
    END;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'total', COALESCE(v_total,0), 'shiny', COALESCE(v_shiny,0), 'awarded', v_awarded);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

SELECT 'Retroactive title check installed' AS status;
