-- ============================================================
-- CHARACTER BOOSTS TABLE (VIP + time-limited boosts)
-- ============================================================

CREATE TABLE IF NOT EXISTS character_boosts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id UUID NOT NULL REFERENCES game_saves(id) ON DELETE CASCADE,
  boost_type TEXT NOT NULL CHECK (boost_type IN ('vip', 'center_anywhere', 'shiny_boost', 'exp_pokemon', 'exp_trainer')),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(character_id, boost_type)
);

ALTER TABLE character_boosts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own character boosts"
  ON character_boosts FOR SELECT
  USING (character_id IN (SELECT id FROM game_saves WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert own character boosts"
  ON character_boosts FOR INSERT
  WITH CHECK (character_id IN (SELECT id FROM game_saves WHERE user_id = auth.uid()));

CREATE POLICY "Users can update own character boosts"
  ON character_boosts FOR UPDATE
  USING (character_id IN (SELECT id FROM game_saves WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete own character boosts"
  ON character_boosts FOR DELETE
  USING (character_id IN (SELECT id FROM game_saves WHERE user_id = auth.uid()));

-- ============================================================
-- SEED: All 5 products in Loja de Diamantes
-- ============================================================

-- Clear old seed products first
DELETE FROM premium_products WHERE destination = 'diamond_shop';

-- 1. VIP 30 Dias - 20 diamonds
INSERT INTO premium_products (name, description, price_diamonds, price_brl, image_url, destination, active, sort_order)
VALUES ('VIP 30 Dias', 'Acesso VIP por 30 dias corridos. Benefícios exclusivos!', 20, 0, '', 'diamond_shop', true, 1);

-- 2. Centro Pokémon em Qualquer Lugar - 10 diamonds, 7 dias
INSERT INTO premium_products (name, description, price_diamonds, price_brl, image_url, destination, active, sort_order)
VALUES ('Centro Pokémon Portátil', 'Cure seus Pokémon em qualquer lugar por 7 dias!', 10, 0, '', 'diamond_shop', true, 2);

-- 3. Boost Shiny - 15 diamonds, 24 horas
INSERT INTO premium_products (name, description, price_diamonds, price_brl, image_url, destination, active, sort_order)
VALUES ('Boost Shiny 24h', 'Dobro de chance de encontrar Shiny no mapa por 24h!', 15, 0, '', 'diamond_shop', true, 3);

-- 4. Boost EXP Pokémon - 12 diamonds, 24 horas
INSERT INTO premium_products (name, description, price_diamonds, price_brl, image_url, destination, active, sort_order)
VALUES ('Boost EXP Pokémon 24h', 'Dobro de experiência para seus Pokémon por 24h!', 12, 0, '', 'diamond_shop', true, 4);

-- 5. Boost EXP Treinador - 12 diamonds, 24 horas
INSERT INTO premium_products (name, description, price_diamonds, price_brl, image_url, destination, active, sort_order)
VALUES ('Boost EXP Treinador 24h', 'Dobro de experiência de treinador por 24h!', 12, 0, '', 'diamond_shop', true, 5);
