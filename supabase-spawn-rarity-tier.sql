-- ============================================================
-- RARIDADE DE SPAWN NO SERVIDOR (lendarios/iniciais quase nulos)
-- ============================================================
-- O cliente ja multiplica o peso por 0.00001 para raridades
-- 'legendary' e 'inicial'. Aqui aplicamos o MESMO multiplicador
-- no servidor, para os spawns da cidade (roll_spawn_by_biome)
-- e por mapa (roll_spawn_encounter) nao sortearam lendarios/
-- iniciais com a mesma frequencia que comuns.

CREATE OR REPLACE FUNCTION roll_spawn_by_biome(
  p_character_id UUID,
  p_biome TEXT,
  p_is_night BOOLEAN DEFAULT false
) RETURNS JSONB AS $$
DECLARE
  v_owner_user_id UUID;
  v_region_id UUID;
  v_map_id UUID;
  v_total_weight NUMERIC;
  v_roll NUMERIC;
  v_enc RECORD;
  v_is_shiny BOOLEAN;
  v_evo_unlocked BOOLEAN;
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

    SELECT current_region_id INTO v_region_id FROM player_progress
    WHERE character_id = p_character_id LIMIT 1;

    IF NOT FOUND OR v_region_id IS NULL THEN
      RETURN jsonb_build_object('error', 'No region found for character');
    END IF;

    SELECT rm.id INTO v_map_id FROM region_maps rm
    WHERE rm.region_id = v_region_id
      AND LOWER(TRIM(rm.name)) = LOWER(TRIM(p_biome))
    ORDER BY rm.sort_order LIMIT 1;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('error', 'No map found for biome: ' || p_biome);
    END IF;

    -- Evento de evolucoes ativo para este bioma?
    v_evo_unlocked := EXISTS(
      SELECT 1 FROM game_events ge
      WHERE ge.event_type = 'evo'
        AND ge.status = 'active'
        AND LOWER(TRIM(COALESCE(ge.config->>'biome', ''))) = LOWER(TRIM(p_biome))
    );

    -- Total weight: horario + filtro de evolucao + peso por raridade
    SELECT SUM(
      COALESCE(me.weight, 50) *
      CASE WHEN me.rarity IN ('legendary', 'inicial') THEN 0.00001 ELSE 1 END
    ) INTO v_total_weight
    FROM map_encounters me
    LEFT JOIN pokemon_spawn_time pst ON pst.pokemon_id = me.pokemon_id
    WHERE me.map_id = v_map_id
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
      LEFT JOIN pokemon_spawn_time pst ON pst.pokemon_id = me.pokemon_id
      WHERE me.map_id = v_map_id
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

-- Mesmo peso por raridade no roll por map_id
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
  v_evo_unlocked BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  SELECT gs.user_id INTO v_owner_user_id FROM game_saves gs WHERE gs.id = p_character_id;
  IF NOT FOUND OR v_owner_user_id != auth.uid() THEN
    RETURN jsonb_build_object('error', 'Not authorized');
  END IF;

  v_evo_unlocked := EXISTS(
    SELECT 1 FROM game_events ge
    WHERE ge.event_type = 'evo'
      AND ge.status = 'active'
      AND LOWER(TRIM(COALESCE(ge.config->>'biome', ''))) = LOWER(TRIM(COALESCE(p_biome, '')))
  );

  SELECT SUM(
    COALESCE(me.weight, 50) *
    CASE WHEN me.rarity IN ('legendary', 'inicial') THEN 0.00001 ELSE 1 END
  ) INTO v_total_weight
  FROM map_encounters me
  WHERE me.map_id = p_map_id
    AND (me.weight IS NULL OR me.weight >= 0)
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
    WHERE me.map_id = p_map_id
      AND (me.weight IS NULL OR me.weight >= 0)
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
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

SELECT 'Spawn rarity tier installed' AS status;
