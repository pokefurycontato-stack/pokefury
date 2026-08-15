-- ============================================================
-- RANK TITLES - títulos permanentes por rank (top 3)
-- Uma vez conquistado, o título permanece com o jogador mesmo
-- que ele perca sua posição no rank.
-- ============================================================

-- Definições dos 9 títulos de rank (todos raridade Mítica)
INSERT INTO titles (id, name, category, threshold, sort_order) VALUES
  ('rank_power_1', 'Monarca da Força', 'rank', 1, 100),
  ('rank_power_2', 'Lenda do Poder', 'rank', 2, 101),
  ('rank_power_3', 'Colosso Supremo', 'rank', 3, 102),
  ('rank_iv_1', 'IV Perfeito', 'rank', 1, 103),
  ('rank_iv_2', 'Genética Suprema', 'rank', 2, 104),
  ('rank_iv_3', 'Potencial Absoluto', 'rank', 3, 105),
  ('rank_trainer_1', 'Mestre Supremo', 'rank', 1, 106),
  ('rank_trainer_2', 'Veterano Lendário', 'rank', 2, 107),
  ('rank_trainer_3', 'Treinador Excepcional', 'rank', 3, 108)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, category = EXCLUDED.category,
  threshold = EXCLUDED.threshold, sort_order = EXCLUDED.sort_order;

-- ============================================================
-- RPC: Concede títulos de rank atuais (permanentes)
-- Verifica as posições do jogador nos 3 ranks e insere os
-- títulos correspondentes em character_titles (idempotente).
-- ============================================================
DROP FUNCTION IF EXISTS award_rank_titles(UUID);
CREATE OR REPLACE FUNCTION award_rank_titles(p_character_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_user_id UUID;
  v_awarded JSONB DEFAULT '[]'::jsonb;
  v_t RECORD;
  v_title_id TEXT;
  v_title_name TEXT;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('error', 'Not authenticated'); END IF;
  SELECT gs.user_id INTO v_user_id FROM game_saves gs WHERE gs.id = p_character_id;
  IF NOT FOUND OR v_user_id != auth.uid() THEN RETURN jsonb_build_object('error', 'Not authorized'); END IF;

  FOR v_t IN
    SELECT 'power' AS rank_type, g.rank_pos FROM get_rank_power() g WHERE g.character_id = p_character_id
    UNION ALL
    SELECT 'iv' AS rank_type, g.rank_pos FROM get_rank_iv() g WHERE g.character_id = p_character_id
    UNION ALL
    SELECT 'trainer' AS rank_type, g.rank_pos FROM get_rank_trainer() g WHERE g.character_id = p_character_id
  LOOP
    v_title_id := 'rank_' || v_t.rank_type || '_' || v_t.rank_pos;
    SELECT name INTO v_title_name FROM titles WHERE id = v_title_id;
    CONTINUE WHEN v_title_name IS NULL;
    INSERT INTO character_titles (character_id, title_id, title_name)
    VALUES (p_character_id, v_title_id, v_title_name)
    ON CONFLICT (character_id, title_id) DO NOTHING;
    IF FOUND THEN
      v_awarded := v_awarded || jsonb_build_object('id', v_title_id, 'name', v_title_name);
    END IF;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'awarded', v_awarded);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

SELECT 'Rank titles installed' AS status;
