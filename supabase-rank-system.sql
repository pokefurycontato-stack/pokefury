-- ============================================================
-- SISTEMA DE RANK (top 3: poder, iv, treinador)
-- ============================================================

-- Colunas de poder e data de captura
ALTER TABLE pokemon_team ADD COLUMN IF NOT EXISTS power INTEGER DEFAULT 0;
ALTER TABLE pokemon_team ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_pokemon_team_power ON pokemon_team(power DESC);
CREATE INDEX IF NOT EXISTS idx_pokemon_team_ivs ON pokemon_team((iv_hp + iv_attack + iv_defense + iv_sp_atk + iv_sp_def + iv_speed) DESC);

-- Backfill aproximado de poder (sem bonus de nature; o client corrige no proximo save)
UPDATE pokemon_team pt
SET power = sub.power
FROM (
  SELECT pt2.id,
    (
      FLOOR(((2*COALESCE(p.hp,50) + COALESCE(pt2.iv_hp,15) + FLOOR(COALESCE(pt2.ev_hp,0)/4)) * pt2.level / 100) + pt2.level + 10)
      + FLOOR(((2*COALESCE(p.attack,50) + COALESCE(pt2.iv_attack,15) + FLOOR(COALESCE(pt2.ev_attack,0)/4)) * pt2.level / 100) + 5)
      + FLOOR(((2*COALESCE(p.defense,50) + COALESCE(pt2.iv_defense,15) + FLOOR(COALESCE(pt2.ev_defense,0)/4)) * pt2.level / 100) + 5)
      + FLOOR(((2*COALESCE(p.sp_atk,50) + COALESCE(pt2.iv_sp_atk,15) + FLOOR(COALESCE(pt2.ev_sp_atk,0)/4)) * pt2.level / 100) + 5)
      + FLOOR(((2*COALESCE(p.sp_def,50) + COALESCE(pt2.iv_sp_def,15) + FLOOR(COALESCE(pt2.ev_sp_def,0)/4)) * pt2.level / 100) + 5)
      + FLOOR(((2*COALESCE(p.speed,50) + COALESCE(pt2.iv_speed,15) + FLOOR(COALESCE(pt2.ev_speed,0)/4)) * pt2.level / 100) + 5)
      + (COALESCE(pt2.iv_hp,15)+COALESCE(pt2.iv_attack,15)+COALESCE(pt2.iv_defense,15)+COALESCE(pt2.iv_sp_atk,15)+COALESCE(pt2.iv_sp_def,15)+COALESCE(pt2.iv_speed,15)) * 3
      + (COALESCE(pt2.ev_hp,0)+COALESCE(pt2.ev_attack,0)+COALESCE(pt2.ev_defense,0)+COALESCE(pt2.ev_sp_atk,0)+COALESCE(pt2.ev_sp_def,0)+COALESCE(pt2.ev_speed,0)) * 0.5
    )::INTEGER AS power
  FROM pokemon_team pt2
  LEFT JOIN pokemon p ON p.id = pt2.pokemon_id
) sub
WHERE sub.id = pt.id AND COALESCE(pt.power, 0) = 0;

-- Posicoes dos sprites de rank na cidade
CREATE TABLE IF NOT EXISTS city_rank_spawns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rank_type TEXT NOT NULL CHECK (rank_type IN ('power','iv','trainer')),
  position INTEGER NOT NULL CHECK (position BETWEEN 1 AND 3),
  pos_x REAL NOT NULL,
  pos_y REAL NOT NULL,
  UNIQUE(rank_type, position)
);

ALTER TABLE city_rank_spawns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "city_rank_spawns_all" ON city_rank_spawns;
CREATE POLICY "city_rank_spawns_all" ON city_rank_spawns FOR ALL USING (true);

-- RPC: top 3 poder
DROP FUNCTION IF EXISTS get_rank_power();
CREATE OR REPLACE FUNCTION get_rank_power()
RETURNS TABLE (
  rank_pos INT, pokemon_id INT, species TEXT, level INT,
  power BIGINT, is_shiny BOOLEAN, character_id UUID, player_name TEXT,
  base_pokemon_id INT, sprite_home TEXT, sprite_official TEXT,
  sprite_front TEXT, sprite_front_shiny TEXT, sprite_home_shiny TEXT, sprite_official_shiny TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ROW_NUMBER() OVER (ORDER BY COALESCE(pt.power,0) DESC)::INT,
    pt.pokemon_id, pt.species, pt.level,
    COALESCE(pt.power,0)::BIGINT, COALESCE(pt.is_shiny,false),
    pt.character_id, COALESCE(gs.player_name,'???'),
    COALESCE(p.base_pokemon_id, pt.pokemon_id),
    p.sprite_home, p.sprite_official,
    p.sprite_front, p.sprite_front_shiny, p.sprite_home_shiny, p.sprite_official_shiny
  FROM pokemon_team pt
  JOIN game_saves gs ON gs.id = pt.character_id
  LEFT JOIN pokemon p ON p.id = pt.pokemon_id
  ORDER BY COALESCE(pt.power,0) DESC, pt.created_at ASC
  LIMIT 3;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: top 3 iv (desempate: capturado primeiro)
DROP FUNCTION IF EXISTS get_rank_iv();
CREATE OR REPLACE FUNCTION get_rank_iv()
RETURNS TABLE (
  rank_pos INT, pokemon_id INT, species TEXT, level INT,
  iv_total INT, is_shiny BOOLEAN, character_id UUID, player_name TEXT,
  base_pokemon_id INT, sprite_home TEXT, sprite_official TEXT,
  sprite_front TEXT, sprite_front_shiny TEXT, sprite_home_shiny TEXT, sprite_official_shiny TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ROW_NUMBER() OVER (ORDER BY (pt.iv_hp+pt.iv_attack+pt.iv_defense+pt.iv_sp_atk+pt.iv_sp_def+pt.iv_speed) DESC, pt.created_at ASC)::INT,
    pt.pokemon_id, pt.species, pt.level,
    (pt.iv_hp+pt.iv_attack+pt.iv_defense+pt.iv_sp_atk+pt.iv_sp_def+pt.iv_speed)::INT,
    COALESCE(pt.is_shiny,false), pt.character_id, COALESCE(gs.player_name,'???'),
    COALESCE(p.base_pokemon_id, pt.pokemon_id),
    p.sprite_home, p.sprite_official,
    p.sprite_front, p.sprite_front_shiny, p.sprite_home_shiny, p.sprite_official_shiny
  FROM pokemon_team pt
  JOIN game_saves gs ON gs.id = pt.character_id
  LEFT JOIN pokemon p ON p.id = pt.pokemon_id
  ORDER BY (pt.iv_hp+pt.iv_attack+pt.iv_defense+pt.iv_sp_atk+pt.iv_sp_def+pt.iv_speed) DESC, pt.created_at ASC
  LIMIT 3;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: top 3 treinador (nivel do personagem)
CREATE OR REPLACE FUNCTION get_rank_trainer()
RETURNS TABLE (
  rank_pos INT, character_id UUID, player_name TEXT,
  trainer_level INT, sprite_url TEXT, player_gender TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ROW_NUMBER() OVER (ORDER BY COALESCE(gs.trainer_level,1) DESC)::INT,
    gs.id, gs.player_name, COALESCE(gs.trainer_level,1)::INT,
    sp.sprite_url, gs.player_gender
  FROM game_saves gs
  LEFT JOIN LATERAL (
    SELECT sp2.sprite_url
    FROM character_skins cs2
    JOIN skin_products sp2 ON sp2.id = cs2.skin_id
    WHERE cs2.character_id = gs.id AND sp2.skin_type = 'player_skin' AND cs2.equipped = true
    LIMIT 1
  ) sp ON true
  ORDER BY COALESCE(gs.trainer_level,1) DESC
  LIMIT 3;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
