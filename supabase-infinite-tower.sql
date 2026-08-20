-- ============================================================
-- SISTEMA DE TORRE INFINITA
-- Layout na cidade + 1000 andares determinísticos + progreso + rank top 100
-- ============================================================

-- ------------------------------------------------------------
-- 1. Layout (posições configurables no city-builder)
-- city_tower_entry : onde o jogador aparece ao entrar na torre
-- city_tower_npc   : posição do NPC (na cidade) que manda à torre
-- city_tower_wild  : onde aparece o sprite do pokemon selvagem na torre
-- city_tower_rank  : onde fica a box de rank (top 5) na cidade
-- city_tower_exit  : onde o jogador aparece ao sair da torre (portal de saída)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS city_tower_entry (
  id INTEGER PRIMARY KEY,
  pos_x REAL NOT NULL,
  pos_y REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS city_tower_npc (
  id INTEGER PRIMARY KEY,
  pos_x REAL NOT NULL,
  pos_y REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS city_tower_wild (
  id INTEGER PRIMARY KEY,
  pos_x REAL NOT NULL,
  pos_y REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS city_tower_rank (
  id INTEGER PRIMARY KEY,
  pos_x REAL NOT NULL,
  pos_y REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS city_tower_exit (
  id INTEGER PRIMARY KEY,
  pos_x REAL NOT NULL,
  pos_y REAL NOT NULL
);

-- ------------------------------------------------------------
-- 2. Encontros da torre (lista determinística, NÃO aleatoria)
-- floor_number: andar 1..1000 (ordem fixa de progresión)
-- pokemon_id / pokemon_name: espécie daquele andar
-- pokemon_level: nível de aquel Pokémon (andar 1 = nv5, andar 100 = nv104...)
-- is_legendary: true se o andar é múltiplo de 10 (lendário)
-- sprite_url: gif animado frontal (anim de spawn)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS infinite_tower_floors (
  floor_number INTEGER PRIMARY KEY,
  pokemon_id INTEGER NOT NULL,
  pokemon_name TEXT NOT NULL,
  pokemon_level INTEGER NOT NULL,
  is_legendary BOOLEAN DEFAULT false,
  sprite_url TEXT
);

-- ------------------------------------------------------------
-- 2b. TORRE INFINITA — EQUIPOS POR ANDAR (novo)
-- Cada andar pode ter 1..10 pokemons en secuencia.
-- Regra de progresión (fixa/determinística):
--   - Andar 1: 1 pokemon nv5 ; sube 1 nv por andar ata nv100 (andar 96).
--   - Ao chegar nv100 (andar 97) añádese un 2º pokemon nv50 que sube
--     1 nv por andar ata nv100. Cando este chega a nv100 (andar 147),
--     añádese un 3º a nv50... así ata 6 pokemons nv100 (andar 351).
--   - Despois continúa a mesma lóxica ata 10 pokemons por andar
--     (andar 555: 10 pokemons nv100). Da 556 en adiante: 10 a nv100.
-- slot_index: 0 = 1º pokemon (sempre presente), 1..9 = engadidos.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS infinite_tower_floor_teams (
  floor_number INTEGER NOT NULL,
  slot_index INTEGER NOT NULL,
  pokemon_id INTEGER NOT NULL,
  pokemon_name TEXT NOT NULL,
  pokemon_level INTEGER NOT NULL,
  is_legendary BOOLEAN DEFAULT false,
  sprite_url TEXT,
  PRIMARY KEY (floor_number, slot_index)
);

-- ------------------------------------------------------------
-- 3. Progreso de cada personaje na torre (a que andar chegou)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS infinite_tower_progress (
  character_id UUID PRIMARY KEY,
  user_id UUID,
  floor INTEGER DEFAULT 1,
  best_floor INTEGER DEFAULT 1,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tower_best ON infinite_tower_progress(best_floor DESC);
-- ------------------------------------------------------------
-- RLS: lectura/configuração livre, progreso protegido
-- ------------------------------------------------------------
ALTER TABLE city_tower_entry ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "city_tower_entry_all" ON city_tower_entry;
CREATE POLICY "city_tower_entry_all" ON city_tower_entry FOR ALL USING (true);

ALTER TABLE city_tower_npc ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "city_tower_npc_all" ON city_tower_npc;
CREATE POLICY "city_tower_npc_all" ON city_tower_npc FOR ALL USING (true);

ALTER TABLE city_tower_wild ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "city_tower_wild_all" ON city_tower_wild;
CREATE POLICY "city_tower_wild_all" ON city_tower_wild FOR ALL USING (true);

ALTER TABLE city_tower_rank ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "city_tower_rank_all" ON city_tower_rank;
CREATE POLICY "city_tower_rank_all" ON city_tower_rank FOR ALL USING (true);

ALTER TABLE city_tower_exit ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "city_tower_exit_all" ON city_tower_exit;
CREATE POLICY "city_tower_exit_all" ON city_tower_exit FOR ALL USING (true);

ALTER TABLE infinite_tower_floors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "itf_all" ON infinite_tower_floors;
CREATE POLICY "itf_all" ON infinite_tower_floors FOR ALL USING (true);

ALTER TABLE infinite_tower_floor_teams ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "itft_all" ON infinite_tower_floor_teams;
CREATE POLICY "itft_all" ON infinite_tower_floor_teams FOR ALL USING (true);
CREATE INDEX IF NOT EXISTS idx_itft_floor ON infinite_tower_floor_teams(floor_number);

ALTER TABLE infinite_tower_progress ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "itp_read" ON infinite_tower_progress;
CREATE POLICY "itp_read" ON infinite_tower_progress FOR SELECT USING (true);
DROP POLICY IF EXISTS "itp_write" ON infinite_tower_progress;
CREATE POLICY "itp_write" ON infinite_tower_progress FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "itp_update" ON infinite_tower_progress;
CREATE POLICY "itp_update" ON infinite_tower_progress FOR UPDATE USING (true);

-- ------------------------------------------------------------
-- RPC: consultar un andar concreto da torre
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS get_tower_floor(INT);
CREATE OR REPLACE FUNCTION get_tower_floor(p_floor_number INT)
RETURNS TABLE (floor_number INT, slot_index INT, pokemon_id INT, pokemon_name TEXT, pokemon_level INT, is_legendary BOOLEAN, sprite_url TEXT) AS $$
  SELECT f.floor_number, f.slot_index, f.pokemon_id, f.pokemon_name, f.pokemon_level, f.is_legendary, f.sprite_url
  FROM infinite_tower_floor_teams f
  WHERE f.floor_number = p_floor_number
  ORDER BY f.slot_index ASC;
$$ LANGUAGE sql SECURITY DEFINER;

-- ------------------------------------------------------------
-- RPC: guardar/avanzar progreso na torre
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS set_tower_progress(UUID, UUID, INT);
CREATE OR REPLACE FUNCTION set_tower_progress(p_character_id UUID, p_user_id UUID, p_floor INT)
RETURNS JSONB AS $$
DECLARE v_best INT;
BEGIN
  IF p_character_id IS NULL THEN RETURN jsonb_build_object('error','no character'); END IF;
  INSERT INTO infinite_tower_progress (character_id, user_id, floor, best_floor, updated_at)
  VALUES (p_character_id, p_user_id, p_floor, p_floor, NOW())
  ON CONFLICT (character_id) DO UPDATE SET
    floor = EXCLUDED.floor,
    user_id = COALESCE(EXCLUDED.user_id, infinite_tower_progress.user_id),
    best_floor = GREATEST(infinite_tower_progress.best_floor, EXCLUDED.floor),
    updated_at = NOW()
  RETURNING best_floor INTO v_best;
  RETURN jsonb_build_object('success', true, 'best_floor', v_best);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ------------------------------------------------------------
-- RPC: rank top (1..p_limit) da torre — máis lonxe primeiro
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS get_tower_rank(INT);
CREATE OR REPLACE FUNCTION get_tower_rank(p_limit INT DEFAULT 100)
RETURNS TABLE (rank_pos INT, character_id UUID, player_name TEXT, best_floor INT, updated_at TIMESTAMPTZ) AS $$
BEGIN
  RETURN QUERY
    SELECT ROW_NUMBER() OVER (ORDER BY tp.best_floor DESC, tp.updated_at ASC)::INT,
           tp.character_id, COALESCE(gs.player_name,'???'), tp.best_floor, tp.updated_at
    FROM infinite_tower_progress tp
    LEFT JOIN game_saves gs ON gs.id = tp.character_id
    ORDER BY tp.best_floor DESC, tp.updated_at ASC
    LIMIT GREATEST(1, p_limit);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ------------------------------------------------------------
-- RPC: progreso/con posição no rank dun xogador (se non está no top 100)
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS get_my_tower_progress(UUID);
CREATE OR REPLACE FUNCTION get_my_tower_progress(p_character_id UUID)
RETURNS TABLE (floor INT, best_floor INT, rank_position INT) AS $$
DECLARE v_best INT;
BEGIN
  SELECT COALESCE(MIN(tp.best_floor),1) INTO v_best FROM infinite_tower_progress tp WHERE tp.character_id = p_character_id;
  IF v_best IS NULL THEN v_best := 1; END IF;
  RETURN QUERY
    SELECT tp.floor, tp.best_floor,
      (SELECT COUNT(*)::int FROM infinite_tower_progress WHERE best_floor > tp.best_floor) + 1
    FROM infinite_tower_progress tp WHERE tp.character_id = p_character_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;