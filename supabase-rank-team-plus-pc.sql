-- ============================================================
-- RANK CONSIDERA TIME + PC (pokemon_team + pokemon_pc)
-- ============================================================
-- Problema: get_rank_power/get_rank_iv consultavam apenas
-- pokemon_team. Quando o treinador colocava um pokemon forte
-- no PC, ele saia do rank como se nao existisse mais.
--
-- Correcao: o rank agora agrega pokemon_team UNION pokemon_pc.
-- O power e calculado on-the-fly com compute_power() para AMBOS,
-- garantindo o mesmo criterio e sempre refletindo nivel/iv/ev
-- atuais (o PC nao tem coluna power persistida).

CREATE OR REPLACE FUNCTION get_rank_power()
RETURNS TABLE (
  rank_pos INT, pokemon_id INT, species TEXT, level INT,
  power BIGINT, is_shiny BOOLEAN, character_id UUID, player_name TEXT,
  base_pokemon_id INT, sprite_home TEXT, sprite_official TEXT,
  sprite_front TEXT, sprite_front_shiny TEXT, sprite_home_shiny TEXT, sprite_official_shiny TEXT
) AS $$
BEGIN
  RETURN QUERY
  WITH all_pokemon AS (
    SELECT
      pt.pokemon_id, pt.species, pt.level,
      compute_power(
        COALESCE(p.hp,50), COALESCE(p.attack,50), COALESCE(p.defense,50),
        COALESCE(p.sp_atk,50), COALESCE(p.sp_def,50), COALESCE(p.speed,50),
        pt.level, pt.iv_hp, pt.iv_attack, pt.iv_defense, pt.iv_sp_atk, pt.iv_sp_def, pt.iv_speed,
        pt.ev_hp, pt.ev_attack, pt.ev_defense, pt.ev_sp_atk, pt.ev_sp_def, pt.ev_speed,
        pt.nature
      )::INTEGER AS power,
      COALESCE(pt.is_shiny,false) AS is_shiny, pt.character_id, pt.created_at,
      COALESCE(p.base_pokemon_id, pt.pokemon_id) AS base_pokemon_id,
      p.sprite_home, p.sprite_official, p.sprite_front,
      p.sprite_front_shiny, p.sprite_home_shiny, p.sprite_official_shiny
    FROM pokemon_team pt
    LEFT JOIN pokemon p ON p.id = pt.pokemon_id
    UNION ALL
    SELECT
      pc.pokemon_id, pc.species, pc.level,
      compute_power(
        COALESCE(p.hp,50), COALESCE(p.attack,50), COALESCE(p.defense,50),
        COALESCE(p.sp_atk,50), COALESCE(p.sp_def,50), COALESCE(p.speed,50),
        pc.level, pc.iv_hp, pc.iv_attack, pc.iv_defense, pc.iv_sp_atk, pc.iv_sp_def, pc.iv_speed,
        pc.ev_hp, pc.ev_attack, pc.ev_defense, pc.ev_sp_atk, pc.ev_sp_def, pc.ev_speed,
        pc.nature
      )::INTEGER AS power,
      COALESCE(pc.is_shiny,false) AS is_shiny, pc.character_id, pc.created_at,
      COALESCE(p.base_pokemon_id, pc.pokemon_id) AS base_pokemon_id,
      p.sprite_home, p.sprite_official, p.sprite_front,
      p.sprite_front_shiny, p.sprite_home_shiny, p.sprite_official_shiny
    FROM pokemon_pc pc
    LEFT JOIN pokemon p ON p.id = pc.pokemon_id
  )
  SELECT
    ROW_NUMBER() OVER (ORDER BY ap.power DESC)::INT,
    ap.pokemon_id, ap.species, ap.level,
    ap.power::BIGINT, ap.is_shiny, ap.character_id,
    COALESCE(gs.player_name,'???'),
    ap.base_pokemon_id, ap.sprite_home, ap.sprite_official, ap.sprite_front,
    ap.sprite_front_shiny, ap.sprite_home_shiny, ap.sprite_official_shiny
  FROM all_pokemon ap
  JOIN game_saves gs ON gs.id = ap.character_id
  ORDER BY ap.power DESC, ap.created_at ASC
  LIMIT 3;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_rank_iv()
RETURNS TABLE (
  rank_pos INT, pokemon_id INT, species TEXT, level INT,
  iv_total INT, is_shiny BOOLEAN, character_id UUID, player_name TEXT,
  base_pokemon_id INT, sprite_home TEXT, sprite_official TEXT,
  sprite_front TEXT, sprite_front_shiny TEXT, sprite_home_shiny TEXT, sprite_official_shiny TEXT
) AS $$
BEGIN
  RETURN QUERY
  WITH all_pokemon AS (
    SELECT
      pt.pokemon_id, pt.species, pt.level,
      (COALESCE(pt.iv_hp,0)+COALESCE(pt.iv_attack,0)+COALESCE(pt.iv_defense,0)+
       COALESCE(pt.iv_sp_atk,0)+COALESCE(pt.iv_sp_def,0)+COALESCE(pt.iv_speed,0))::INT AS iv_total,
      COALESCE(pt.is_shiny,false) AS is_shiny, pt.character_id, pt.created_at,
      COALESCE(p.base_pokemon_id, pt.pokemon_id) AS base_pokemon_id,
      p.sprite_home, p.sprite_official, p.sprite_front,
      p.sprite_front_shiny, p.sprite_home_shiny, p.sprite_official_shiny
    FROM pokemon_team pt
    LEFT JOIN pokemon p ON p.id = pt.pokemon_id
    UNION ALL
    SELECT
      pc.pokemon_id, pc.species, pc.level,
      (COALESCE(pc.iv_hp,0)+COALESCE(pc.iv_attack,0)+COALESCE(pc.iv_defense,0)+
       COALESCE(pc.iv_sp_atk,0)+COALESCE(pc.iv_sp_def,0)+COALESCE(pc.iv_speed,0))::INT AS iv_total,
      COALESCE(pc.is_shiny,false) AS is_shiny, pc.character_id, pc.created_at,
      COALESCE(p.base_pokemon_id, pc.pokemon_id) AS base_pokemon_id,
      p.sprite_home, p.sprite_official, p.sprite_front,
      p.sprite_front_shiny, p.sprite_home_shiny, p.sprite_official_shiny
    FROM pokemon_pc pc
    LEFT JOIN pokemon p ON p.id = pc.pokemon_id
  )
  SELECT
    ROW_NUMBER() OVER (ORDER BY ap.iv_total DESC)::INT,
    ap.pokemon_id, ap.species, ap.level,
    ap.iv_total, ap.is_shiny, ap.character_id,
    COALESCE(gs.player_name,'???'),
    ap.base_pokemon_id, ap.sprite_home, ap.sprite_official, ap.sprite_front,
    ap.sprite_front_shiny, ap.sprite_home_shiny, ap.sprite_official_shiny
  FROM all_pokemon ap
  JOIN game_saves gs ON gs.id = ap.character_id
  ORDER BY ap.iv_total DESC, ap.created_at ASC
  LIMIT 3;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

SELECT 'Rank now includes Team + PC pokemon' AS status;
