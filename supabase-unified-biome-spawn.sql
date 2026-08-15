-- ============================================================
-- BIOMAS UNIFICADOS (todas as regioes juntas no mesmo bioma)
-- ============================================================
-- Antes: roll_spawn_by_biome escolhia apenas UM mapa do bioma
-- na regiao atual do treinador (ORDER BY sort_order LIMIT 1),
-- deixando o pool com 0-4 especies quando os mapas tinham
-- poucas formas base (Vulcao/Geleira/Industrial, etc).
--
-- Agora: TODOS os mapas com o nome do bioma (em QUALQUER regiao)
-- sao agregados em um unico pool, dando variedade de especies
-- sem precisar viajar entre regioes. Regras preservadas:
--   * evolucoes continuam bloqueadas por padrao (liberadas por evento)
--   * lendarios/iniciais continuam com peso x0.00001
--   * filtro de horario (dia/noite) continua aplicado
--   * shiny continua 1/4096

CREATE OR REPLACE FUNCTION roll_spawn_by_biome(
  p_character_id UUID,
  p_biome TEXT,
  p_is_night BOOLEAN DEFAULT false
) RETURNS JSONB AS $$
DECLARE
  v_owner_user_id UUID;
  v_total_weight NUMERIC;
  v_roll NUMERIC;
  v_enc RECORD;
  v_is_shiny BOOLEAN;
  v_evo_unlocked BOOLEAN;
  v_has_maps BOOLEAN;
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

    -- Existe ao menos um mapa com esse nome de bioma (em qualquer regiao)?
    SELECT EXISTS(
      SELECT 1 FROM region_maps rm
      WHERE LOWER(TRIM(rm.name)) = LOWER(TRIM(p_biome))
    ) INTO v_has_maps;

    IF NOT v_has_maps THEN
      RETURN jsonb_build_object('error', 'No map found for biome: ' || p_biome);
    END IF;

    -- Evento de evolucoes ativo para este bioma?
    v_evo_unlocked := EXISTS(
      SELECT 1 FROM game_events ge
      WHERE ge.event_type = 'evo'
        AND ge.status = 'active'
        AND LOWER(TRIM(COALESCE(ge.config->>'biome', ''))) = LOWER(TRIM(p_biome))
    );

    -- Total weight: TODOS os mapas do bioma (todas as regioes)
    SELECT SUM(
      COALESCE(me.weight, 50) *
      CASE WHEN me.rarity IN ('legendary', 'inicial') THEN 0.00001 ELSE 1 END
    ) INTO v_total_weight
    FROM map_encounters me
    JOIN region_maps rm ON rm.id = me.map_id
    LEFT JOIN pokemon_spawn_time pst ON pst.pokemon_id = me.pokemon_id
    WHERE LOWER(TRIM(rm.name)) = LOWER(TRIM(p_biome))
      AND (me.weight IS NULL OR me.weight >= 0)
      AND (
        pst.time_of_day IS NULL
        OR (p_is_night AND pst.time_of_day = 'night')
        OR (NOT p_is_night AND pst.time_of_day = 'day')
      )
      AND (
        v_evo_unlocked
        OR NOT EXISTS (
          SELECT 1 FROM pokemon_evolutions pe
          WHERE pe.to_pokemon_id = me.pokemon_id
        )
      );

    IF v_total_weight IS NULL OR v_total_weight <= 0 THEN
      RETURN jsonb_build_object('error', 'No encounters available');
    END IF;

    v_roll := random() * v_total_weight;

    FOR v_enc IN
      SELECT me.pokemon_id, me.pokemon_name, me.weight, me.min_level, me.max_level, me.sprite_url, me.rarity
      FROM map_encounters me
      JOIN region_maps rm ON rm.id = me.map_id
      LEFT JOIN pokemon_spawn_time pst ON pst.pokemon_id = me.pokemon_id
      WHERE LOWER(TRIM(rm.name)) = LOWER(TRIM(p_biome))
        AND (me.weight IS NULL OR me.weight >= 0)
        AND (
          pst.time_of_day IS NULL
          OR (p_is_night AND pst.time_of_day = 'night')
          OR (NOT p_is_night AND pst.time_of_day = 'day')
        )
        AND (
          v_evo_unlocked
          OR NOT EXISTS (
            SELECT 1 FROM pokemon_evolutions pe
            WHERE pe.to_pokemon_id = me.pokemon_id
          )
        )
    LOOP
      v_roll := v_roll - (
        COALESCE(v_enc.weight, 50) *
        CASE WHEN v_enc.rarity IN ('legendary', 'inicial') THEN 0.00001 ELSE 1 END
      );
      IF v_roll <= 0 THEN
        v_is_shiny := random() < (1.0 / 4096.0);
        RETURN jsonb_build_object(
          'success', true,
          'pokemon_id', v_enc.pokemon_id,
          'pokemon_name', v_enc.pokemon_name,
          'min_level', COALESCE(v_enc.min_level, 2),
          'max_level', COALESCE(v_enc.max_level, 8),
          'is_shiny', v_is_shiny,
          'sprite_url', v_enc.sprite_url,
          'evo_unlocked', v_evo_unlocked
        );
      END IF;
    END LOOP;

    RETURN jsonb_build_object('error', 'Roll failed');
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('error', 'RPC error: ' || SQLERRM);
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

SELECT 'Unified biome spawn installed (all regions merged)' AS status;
