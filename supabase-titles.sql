-- ============================================================
-- TITLE SYSTEM - títulos secretos (server-side)
-- ============================================================

-- Estatísticas do personagem (contadores)
CREATE TABLE IF NOT EXISTS character_stats (
  character_id UUID PRIMARY KEY REFERENCES game_saves(id) ON DELETE CASCADE,
  wild_kills INTEGER NOT NULL DEFAULT 0,
  catches INTEGER NOT NULL DEFAULT 0,
  shiny_catches INTEGER NOT NULL DEFAULT 0
);

ALTER TABLE character_stats ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "stats_select" ON character_stats;
CREATE POLICY "stats_select" ON character_stats FOR SELECT USING (true);
DROP POLICY IF EXISTS "stats_block_insert" ON character_stats;
CREATE POLICY "stats_block_insert" ON character_stats FOR INSERT WITH CHECK (false);
DROP POLICY IF EXISTS "stats_block_update" ON character_stats;
CREATE POLICY "stats_block_update" ON character_stats FOR UPDATE USING (false);
DROP POLICY IF EXISTS "stats_block_delete" ON character_stats;
CREATE POLICY "stats_block_delete" ON character_stats FOR DELETE USING (false);

-- Definições de títulos estáticos
CREATE TABLE IF NOT EXISTS titles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  threshold INTEGER DEFAULT 0,
  sort_order INTEGER DEFAULT 0
);

INSERT INTO titles (id, name, category, threshold, sort_order) VALUES
  ('trainer_beginner', 'Treinador Iniciante', 'wild_kills', 10, 1),
  ('trainer_intermediate', 'Treinador Intermediario', 'wild_kills', 500, 2),
  ('trainer_senior', 'Treinador Senior', 'wild_kills', 5000, 3),
  ('trainer_master', 'Mestre entre os Treinadores', 'wild_kills', 1000000, 4),
  ('collector_beginner', 'Colecionador Iniciante', 'catches', 10, 5),
  ('collector_dedicated', 'Colecionador Dedicado', 'catches', 100, 6),
  ('collector_expert', 'Colecionador Experiente', 'catches', 500, 7),
  ('collector_master', 'Mestre Colecionador', 'catches', 2000, 8),
  ('shiny_hunter', 'Cacador de Shiny', 'shiny', 5, 9),
  ('shiny_legend', 'Lenda Brilhante', 'shiny', 50, 10)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, category = EXCLUDED.category, threshold = EXCLUDED.threshold, sort_order = EXCLUDED.sort_order;

-- Títulos conquistados por personagem
CREATE TABLE IF NOT EXISTS character_titles (
  character_id UUID NOT NULL REFERENCES game_saves(id) ON DELETE CASCADE,
  title_id TEXT NOT NULL,
  title_name TEXT NOT NULL,
  earned_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (character_id, title_id)
);

ALTER TABLE character_titles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "char_titles_select" ON character_titles;
CREATE POLICY "char_titles_select" ON character_titles FOR SELECT USING (true);
DROP POLICY IF EXISTS "char_titles_block_insert" ON character_titles;
CREATE POLICY "char_titles_block_insert" ON character_titles FOR INSERT WITH CHECK (false);
DROP POLICY IF EXISTS "char_titles_block_update" ON character_titles;
CREATE POLICY "char_titles_block_update" ON character_titles FOR UPDATE USING (false);
DROP POLICY IF EXISTS "char_titles_block_delete" ON character_titles;
CREATE POLICY "char_titles_block_delete" ON character_titles FOR DELETE USING (false);

-- Título equipado no game_saves
ALTER TABLE game_saves ADD COLUMN IF NOT EXISTS equipped_title TEXT DEFAULT NULL;
ALTER TABLE game_saves ADD COLUMN IF NOT EXISTS equipped_title_name TEXT DEFAULT NULL;

-- Título equipado exibido na cidade (realtime)
ALTER TABLE city_players ADD COLUMN IF NOT EXISTS equipped_title TEXT DEFAULT NULL;
ALTER TABLE city_players ADD COLUMN IF NOT EXISTS equipped_title_id TEXT DEFAULT NULL;

-- ============================================================
-- RPC: Registrar abate de pokemon selvagem + verificar títulos
-- ============================================================
CREATE OR REPLACE FUNCTION record_wild_kill(p_character_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_user_id UUID;
  v_kills INTEGER;
  v_awarded JSONB DEFAULT '[]'::jsonb;
  v_title RECORD;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('error', 'Not authenticated'); END IF;
  SELECT gs.user_id INTO v_user_id FROM game_saves gs WHERE gs.id = p_character_id;
  IF NOT FOUND OR v_user_id != auth.uid() THEN RETURN jsonb_build_object('error', 'Not authorized'); END IF;

  INSERT INTO character_stats (character_id, wild_kills) VALUES (p_character_id, 1)
  ON CONFLICT (character_id) DO UPDATE SET wild_kills = character_stats.wild_kills + 1
  RETURNING wild_kills INTO v_kills;

  FOR v_title IN SELECT * FROM titles WHERE category = 'wild_kills' AND threshold <= v_kills ORDER BY threshold LOOP
    IF NOT EXISTS(SELECT 1 FROM character_titles WHERE character_id = p_character_id AND title_id = v_title.id) THEN
      INSERT INTO character_titles (character_id, title_id, title_name) VALUES (p_character_id, v_title.id, v_title.name);
      v_awarded := v_awarded || jsonb_build_object('id', v_title.id, 'name', v_title.name);
    END IF;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'wild_kills', v_kills, 'awarded', v_awarded);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- RPC: Registrar captura + verificar títulos (inclui lendários)
-- ============================================================
CREATE OR REPLACE FUNCTION record_capture(
  p_character_id UUID,
  p_pokemon_id INTEGER,
  p_pokemon_name TEXT,
  p_is_shiny BOOLEAN DEFAULT false
) RETURNS JSONB AS $$
DECLARE
  v_user_id UUID;
  v_catches INTEGER;
  v_shiny INTEGER;
  v_awarded JSONB DEFAULT '[]'::jsonb;
  v_title RECORD;
  v_is_legendary BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('error', 'Not authenticated'); END IF;
  SELECT gs.user_id INTO v_user_id FROM game_saves gs WHERE gs.id = p_character_id;
  IF NOT FOUND OR v_user_id != auth.uid() THEN RETURN jsonb_build_object('error', 'Not authorized'); END IF;

  -- Detecção de lendário server-side
  v_is_legendary := p_pokemon_id IN (
    144,145,146,150,151,243,244,245,249,250,251,377,378,379,380,381,382,383,384,385,386,
    480,481,482,483,484,485,486,487,488,489,490,491,492,493,494,638,639,640,641,642,643,644,645,646,647,648,649,
    716,717,718,719,720,721,772,773,785,786,787,788,789,790,791,792,800,801,802,803,804,805,806,807,808,809,
    888,889,890,891,892,894,895,896,897,898,905,
    1001,1002,1003,1004,1007,1008,1009,1010,1014,1015,1016,1017,1020,1021,1022,1023,1024,1025
  );

  INSERT INTO character_stats (character_id, catches, shiny_catches)
  VALUES (p_character_id, 1, CASE WHEN p_is_shiny THEN 1 ELSE 0 END)
  ON CONFLICT (character_id) DO UPDATE SET
    catches = character_stats.catches + 1,
    shiny_catches = character_stats.shiny_catches + CASE WHEN p_is_shiny THEN 1 ELSE 0 END;

  SELECT catches, shiny_catches INTO v_catches, v_shiny FROM character_stats WHERE character_id = p_character_id;

  FOR v_title IN SELECT * FROM titles WHERE category = 'catches' AND threshold <= v_catches ORDER BY threshold LOOP
    IF NOT EXISTS(SELECT 1 FROM character_titles WHERE character_id = p_character_id AND title_id = v_title.id) THEN
      INSERT INTO character_titles (character_id, title_id, title_name) VALUES (p_character_id, v_title.id, v_title.name);
      v_awarded := v_awarded || jsonb_build_object('id', v_title.id, 'name', v_title.name);
    END IF;
  END LOOP;

  FOR v_title IN SELECT * FROM titles WHERE category = 'shiny' AND threshold <= v_shiny ORDER BY threshold LOOP
    IF NOT EXISTS(SELECT 1 FROM character_titles WHERE character_id = p_character_id AND title_id = v_title.id) THEN
      INSERT INTO character_titles (character_id, title_id, title_name) VALUES (p_character_id, v_title.id, v_title.name);
      v_awarded := v_awarded || jsonb_build_object('id', v_title.id, 'name', v_title.name);
    END IF;
  END LOOP;

  IF v_is_legendary THEN
    DECLARE
      v_tid TEXT := 'master_' || p_pokemon_id::text;
      v_tname TEXT := 'Mestre de ' || p_pokemon_name;
    BEGIN
      IF NOT EXISTS(SELECT 1 FROM character_titles WHERE character_id = p_character_id AND title_id = v_tid) THEN
        INSERT INTO character_titles (character_id, title_id, title_name) VALUES (p_character_id, v_tid, v_tname);
        v_awarded := v_awarded || jsonb_build_object('id', v_tid, 'name', v_tname);
      END IF;
    END;
  END IF;

  RETURN jsonb_build_object('success', true, 'catches', v_catches, 'awarded', v_awarded);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- RPC: Listar títulos conquistados
-- ============================================================
CREATE OR REPLACE FUNCTION get_earned_titles(p_character_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('error', 'Not authenticated'); END IF;
  SELECT jsonb_agg(jsonb_build_object('id', ct.title_id, 'name', ct.title_name, 'earned_at', ct.earned_at) ORDER BY ct.earned_at DESC)
  INTO v_result FROM character_titles ct WHERE ct.character_id = p_character_id;
  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- RPC: Equipar título (só pode equipar um que já conquistou)
-- ============================================================
CREATE OR REPLACE FUNCTION equip_title(p_character_id UUID, p_title_id TEXT)
RETURNS JSONB AS $$
DECLARE
  v_user_id UUID;
  v_title_name TEXT;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('error', 'Not authenticated'); END IF;
  SELECT gs.user_id INTO v_user_id FROM game_saves gs WHERE gs.id = p_character_id;
  IF NOT FOUND OR v_user_id != auth.uid() THEN RETURN jsonb_build_object('error', 'Not authorized'); END IF;

  IF p_title_id IS NULL OR p_title_id = '' THEN
    UPDATE game_saves SET equipped_title = NULL, equipped_title_name = NULL WHERE id = p_character_id;
    RETURN jsonb_build_object('success', true, 'equipped', null);
  END IF;

  SELECT title_name INTO v_title_name FROM character_titles
  WHERE character_id = p_character_id AND title_id = p_title_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Title not earned');
  END IF;

  UPDATE game_saves SET equipped_title = p_title_id, equipped_title_name = v_title_name WHERE id = p_character_id;
  RETURN jsonb_build_object('success', true, 'equipped', v_title_name);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

SELECT 'Title system installed' AS status;
