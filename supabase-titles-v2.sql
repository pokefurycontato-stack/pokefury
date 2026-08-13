-- ============================================================
-- TITLE SYSTEM v2 - Novas categorias (quests, derrotas, curas, compras)
-- ============================================================

-- Novos contadores
ALTER TABLE character_stats ADD COLUMN IF NOT EXISTS quests_completed INTEGER NOT NULL DEFAULT 0;
ALTER TABLE character_stats ADD COLUMN IF NOT EXISTS wild_losses INTEGER NOT NULL DEFAULT 0;
ALTER TABLE character_stats ADD COLUMN IF NOT EXISTS nurse_heals INTEGER NOT NULL DEFAULT 0;
ALTER TABLE character_stats ADD COLUMN IF NOT EXISTS pokeballs_bought INTEGER NOT NULL DEFAULT 0;
ALTER TABLE character_stats ADD COLUMN IF NOT EXISTS heal_items_bought INTEGER NOT NULL DEFAULT 0;

-- Novos títulos
INSERT INTO titles (id, name, category, threshold, sort_order) VALUES
  ('entendendo_mundo', 'Entendendo o Mundo', 'quests', 5, 20),
  ('sabio_treinamento', 'Sabio em treinamento', 'quests', 30, 21),
  ('anciao_pleno', 'Anciao Pleno', 'quests', 50, 22),
  ('estou_azar', 'Estou com azar', 'wild_losses', 10, 30),
  ('hoje_nao_bom_dia', 'Hoje nao e um bom dia', 'wild_losses', 30, 31),
  ('azarao_total', 'Azarao total', 'wild_losses', 50, 32),
  ('mestre_derrotado', 'Mestre em ser derrotado', 'wild_losses', 100, 33),
  ('visitante_centro', 'Visitante do Centro Pokemon', 'nurse_heals', 5, 40),
  ('amigo_joy', 'Amigo da Enfermeira Joy', 'nurse_heals', 50, 41),
  ('morador_centro', 'Morador do Centro Pokemon', 'nurse_heals', 200, 42),
  ('bolsos_cheios', 'Bolsos Cheios', 'pokeballs', 500, 50),
  ('estoque_renovado', 'Estoque Renovado', 'pokeballs', 1500, 51),
  ('almoxarifado_pokeballs', 'Almoxarifado de Pokeballs', 'pokeballs', 2500, 52),
  ('estoque_emergencia', 'Estoque de Emergencia', 'heal_items', 100, 60),
  ('hospital_ambulante', 'Hospital Ambulante', 'heal_items', 500, 61),
  ('magnata_cura', 'Magnata da Cura', 'heal_items', 1500, 62)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, category = EXCLUDED.category, threshold = EXCLUDED.threshold, sort_order = EXCLUDED.sort_order;

-- ============================================================
-- RPC genérico para incrementar estatística e verificar títulos
-- ============================================================
CREATE OR REPLACE FUNCTION record_stat(
  p_character_id UUID,
  p_stat TEXT,
  p_amount INTEGER DEFAULT 1
) RETURNS JSONB AS $$
DECLARE
  v_user_id UUID;
  v_value INTEGER;
  v_awarded JSONB DEFAULT '[]'::jsonb;
  v_title RECORD;
  v_category TEXT;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('error', 'Not authenticated'); END IF;
  SELECT gs.user_id INTO v_user_id FROM game_saves gs WHERE gs.id = p_character_id;
  IF NOT FOUND OR v_user_id != auth.uid() THEN RETURN jsonb_build_object('error', 'Not authorized'); END IF;

  -- Validar e mapear stat -> categoria
  IF p_stat = 'quests_completed' THEN v_category := 'quests';
  ELSIF p_stat = 'wild_losses' THEN v_category := 'wild_losses';
  ELSIF p_stat = 'nurse_heals' THEN v_category := 'nurse_heals';
  ELSIF p_stat = 'pokeballs_bought' THEN v_category := 'pokeballs';
  ELSIF p_stat = 'heal_items_bought' THEN v_category := 'heal_items';
  ELSE RETURN jsonb_build_object('error', 'Invalid stat');
  END IF;

  -- Incrementar (coluna dinâmica com nome validado)
  EXECUTE format('INSERT INTO character_stats (character_id, %I) VALUES ($1, $2) ON CONFLICT (character_id) DO UPDATE SET %I = character_stats.%I + $2', p_stat, p_stat, p_stat)
  USING p_character_id, p_amount;

  EXECUTE format('SELECT %I FROM character_stats WHERE character_id = $1', p_stat) INTO v_value USING p_character_id;

  FOR v_title IN SELECT * FROM titles WHERE category = v_category AND threshold <= v_value ORDER BY threshold LOOP
    IF NOT EXISTS(SELECT 1 FROM character_titles WHERE character_id = p_character_id AND title_id = v_title.id) THEN
      INSERT INTO character_titles (character_id, title_id, title_name) VALUES (p_character_id, v_title.id, v_title.name);
      v_awarded := v_awarded || jsonb_build_object('id', v_title.id, 'name', v_title.name);
    END IF;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'value', v_value, 'awarded', v_awarded);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

SELECT 'Title system v2 installed' AS status;
