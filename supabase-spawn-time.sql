-- ============================================================
-- POKEMON SPAWN TIME (diurnal/nocturnal) - server-side
-- ============================================================

CREATE TABLE IF NOT EXISTS pokemon_spawn_time (
  pokemon_id INTEGER PRIMARY KEY,
  time_of_day TEXT NOT NULL CHECK (time_of_day IN ('day', 'night'))
);

DELETE FROM pokemon_spawn_time;

-- Nocturnal pokemon (so aparecem de noite)
INSERT INTO pokemon_spawn_time (pokemon_id, time_of_day) VALUES
(19,'night'),(20,'night'),(41,'night'),(42,'night'),(169,'night'),
(92,'night'),(93,'night'),(94,'night'),(163,'night'),(164,'night'),
(198,'night'),(200,'night'),(215,'night'),(461,'night'),
(228,'night'),(229,'night'),(167,'night'),(168,'night'),
(261,'night'),(262,'night'),(302,'night'),(353,'night'),(354,'night'),
(355,'night'),(356,'night'),(477,'night'),(358,'night'),
(207,'night'),(472,'night'),(434,'night'),(435,'night'),
(425,'night'),(426,'night'),(442,'night'),(453,'night'),(454,'night'),
(331,'night'),(332,'night'),(48,'night'),(49,'night'),
(96,'night'),(97,'night'),(35,'night'),(36,'night'),(46,'night'),(47,'night')
ON CONFLICT (pokemon_id) DO UPDATE SET time_of_day = EXCLUDED.time_of_day;

-- Diurnal pokemon (so aparecem de dia)
INSERT INTO pokemon_spawn_time (pokemon_id, time_of_day) VALUES
(10,'day'),(11,'day'),(12,'day'),(13,'day'),(14,'day'),(15,'day'),
(16,'day'),(17,'day'),(18,'day'),(21,'day'),(22,'day'),(43,'day'),
(44,'day'),(45,'day'),(69,'day'),(70,'day'),(71,'day'),(172,'day'),
(25,'day'),(26,'day'),(52,'day'),(53,'day'),(54,'day'),(55,'day'),
(83,'day'),(84,'day'),(85,'day'),(58,'day'),(59,'day'),(179,'day'),
(180,'day'),(181,'day'),(187,'day'),(188,'day'),(189,'day'),
(191,'day'),(192,'day'),(193,'day'),(194,'day'),(283,'day'),
(284,'day'),(285,'day'),(406,'day'),(407,'day'),(408,'day'),
(415,'day'),(416,'day'),(417,'day'),(418,'day'),(420,'day'),
(421,'day'),(422,'day'),(423,'day')
ON CONFLICT (pokemon_id) DO UPDATE SET time_of_day = EXCLUDED.time_of_day;

-- ============================================================
-- RPC atualizado com filtro dia/noite
-- ============================================================

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

    -- Total weight, filtrando por horario
    SELECT SUM(COALESCE(me.weight, 50)) INTO v_total_weight
    FROM map_encounters me
    LEFT JOIN pokemon_spawn_time pst ON pst.pokemon_id = me.pokemon_id
    WHERE me.map_id = v_map_id
      AND (me.weight IS NULL OR me.weight >= 0)
      AND (
        pst.time_of_day IS NULL
        OR (p_is_night AND pst.time_of_day = 'night')
        OR (NOT p_is_night AND pst.time_of_day = 'day')
      );

    IF v_total_weight IS NULL OR v_total_weight <= 0 THEN
      RETURN jsonb_build_object('error', 'No encounters available');
    END IF;

    v_roll := random() * v_total_weight;

    FOR v_enc IN
      SELECT me.pokemon_id, me.pokemon_name, me.weight, me.min_level, me.max_level, me.sprite_url
      FROM map_encounters me
      LEFT JOIN pokemon_spawn_time pst ON pst.pokemon_id = me.pokemon_id
      WHERE me.map_id = v_map_id
        AND (me.weight IS NULL OR me.weight >= 0)
        AND (
          pst.time_of_day IS NULL
          OR (p_is_night AND pst.time_of_day = 'night')
          OR (NOT p_is_night AND pst.time_of_day = 'day')
        )
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

SELECT 'Spawn time system installed' AS status;
