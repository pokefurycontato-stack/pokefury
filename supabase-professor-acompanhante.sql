-- ============================================================
-- PROFESSOR ACOMPANHANTE
-- Produto de 50 diamantes (30 dias) + novo tipo de boost.
-- Executar no SQL Editor do Supabase.
-- ============================================================

-- 1. Produto na Loja de Diamantes (50 diamantes)
DELETE FROM premium_products WHERE name = 'Professor Acompanhante';
INSERT INTO premium_products (name, description, price_diamonds, price_brl, image_url, destination, active, sort_order)
VALUES ('Professor Acompanhante', 'Auto Farm inteligente por 30 dias: envia primeiro o Pokémon com vantagem de tipo na batalha!', 50, 0, '', 'diamond_shop', true, 6);

-- 2. Libera o novo tipo no CHECK constraint de character_boosts
ALTER TABLE character_boosts DROP CONSTRAINT IF EXISTS character_boosts_boost_type_check;
ALTER TABLE character_boosts ADD CONSTRAINT character_boosts_boost_type_check
  CHECK (boost_type IN ('vip', 'center_anywhere', 'shiny_boost', 'exp_pokemon', 'exp_trainer', 'professor_acompanhante'));

-- 3. Libera o novo tipo na whitelist do safe_purchase_boost
CREATE OR REPLACE FUNCTION safe_purchase_boost(
  p_character_id UUID,
  p_boost_type TEXT,
  p_duration_ms BIGINT
) RETURNS JSONB AS $$
DECLARE
  v_owner_user_id UUID;
  v_expires_at TIMESTAMPTZ;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  SELECT gs.user_id INTO v_owner_user_id FROM game_saves gs WHERE gs.id = p_character_id;
  IF NOT FOUND OR v_owner_user_id != auth.uid() THEN
    RETURN jsonb_build_object('error', 'Not authorized');
  END IF;

  IF p_boost_type NOT IN ('vip', 'center_anywhere', 'shiny_boost', 'exp_pokemon', 'exp_trainer', 'professor_acompanhante') THEN
    RETURN jsonb_build_object('error', 'Invalid boost type');
  END IF;

  v_expires_at := NOW() + (p_duration_ms || ' milliseconds')::INTERVAL;

  INSERT INTO character_boosts (character_id, boost_type, expires_at)
  VALUES (p_character_id, p_boost_type, v_expires_at)
  ON CONFLICT (character_id, boost_type) DO UPDATE
  SET expires_at = EXCLUDED.expires_at;

  RETURN jsonb_build_object('success', true, 'boost_type', p_boost_type, 'expires_at', v_expires_at);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;