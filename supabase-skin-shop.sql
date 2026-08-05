-- ============================================================
-- SKIN SHOP - Tabelas, RLS e RPCs
-- ============================================================

-- 1. Tabela de produtos de skin
CREATE TABLE IF NOT EXISTS skin_products (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name           TEXT NOT NULL,
  description    TEXT DEFAULT '',
  skin_type      TEXT NOT NULL CHECK (skin_type IN ('pokemon_skin', 'player_skin')),
  target_id      TEXT DEFAULT '',
  price_diamonds INTEGER DEFAULT 0,
  image_url      TEXT DEFAULT '',
  sprite_url     TEXT DEFAULT '',
  active         BOOLEAN DEFAULT true,
  sort_order     INTEGER DEFAULT 0,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Tabelas de skins compradas por personagem
CREATE TABLE IF NOT EXISTS character_skins (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id   UUID NOT NULL REFERENCES game_saves(id) ON DELETE CASCADE,
  skin_id        UUID NOT NULL REFERENCES skin_products(id) ON DELETE CASCADE,
  equipped       BOOLEAN DEFAULT false,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(character_id, skin_id)
);

-- 3. RLS - skin_products
ALTER TABLE skin_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "skin_products_select_active" ON skin_products
  FOR SELECT USING (active = true);

CREATE POLICY "skin_products_admin_all" ON skin_products
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true)
  );

-- 4. RLS - character_skins
ALTER TABLE character_skins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "character_skins_select_own" ON character_skins
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM game_saves WHERE game_saves.id = character_skins.character_id AND game_saves.user_id = auth.uid())
  );

CREATE POLICY "character_skins_insert_own" ON character_skins
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM game_saves WHERE game_saves.id = character_skins.character_id AND game_saves.user_id = auth.uid())
  );

CREATE POLICY "character_skins_update_own" ON character_skins
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM game_saves WHERE game_saves.id = character_skins.character_id AND game_saves.user_id = auth.uid())
  );

CREATE POLICY "character_skins_delete_own" ON character_skins
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM game_saves WHERE game_saves.id = character_skins.character_id AND game_saves.user_id = auth.uid())
  );

-- 5. RPC: Comprar skin (cobra diamantes e registra)
CREATE OR REPLACE FUNCTION buy_skin(p_character_id UUID, p_skin_id UUID)
RETURNS JSON AS $$
DECLARE
  v_price INTEGER;
  v_user_id UUID;
  v_has_skin BOOLEAN;
BEGIN
  -- Verificar ownership
  SELECT user_id INTO v_user_id FROM game_saves WHERE id = p_character_id;
  IF v_user_id != auth.uid() THEN
    RETURN json_build_object('error', 'Unauthorized');
  END IF;

  -- Verificar se já comprou
  SELECT EXISTS(SELECT 1 FROM character_skins WHERE character_id = p_character_id AND skin_id = p_skin_id) INTO v_has_skin;
  IF v_has_skin THEN
    RETURN json_build_object('error', 'Already owned');
  END IF;

  -- Pegar preço
  SELECT price_diamonds INTO v_price FROM skin_products WHERE id = p_skin_id AND active = true;
  IF v_price IS NULL THEN
    RETURN json_build_object('error', 'Product not found');
  END IF;

  -- Verificar saldo (via RPC existente)
  -- O frontend chama spend_currency separadamente

  -- Registrar compra
  INSERT INTO character_skins (character_id, skin_id) VALUES (p_character_id, p_skin_id);

  RETURN json_build_object('ok', true, 'price', v_price);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. RPC: Equipar/dessequipar skin
CREATE OR REPLACE FUNCTION equip_skin(p_character_id UUID, p_skin_id UUID)
RETURNS JSON AS $$
DECLARE
  v_user_id UUID;
  v_skin_type TEXT;
BEGIN
  SELECT user_id INTO v_user_id FROM game_saves WHERE id = p_character_id;
  IF v_user_id != auth.uid() THEN
    RETURN json_build_object('error', 'Unauthorized');
  END IF;

  SELECT sp.skin_type INTO v_skin_type
  FROM character_skins cs
  JOIN skin_products sp ON sp.id = cs.skin_id
  WHERE cs.character_id = p_character_id AND cs.skin_id = p_skin_id;

  IF v_skin_type IS NULL THEN
    RETURN json_build_object('error', 'Skin not owned');
  END IF;

  -- Desativar outras skins do mesmo tipo
  UPDATE character_skins SET equipped = false
  WHERE character_id = p_character_id
    AND skin_id IN (
      SELECT cs2.skin_id FROM character_skins cs2
      JOIN skin_products sp2 ON sp2.id = cs2.skin_id
      WHERE cs2.character_id = p_character_id AND sp2.skin_type = v_skin_type
    );

  -- Ativar a skin escolhida
  UPDATE character_skins SET equipped = true
  WHERE character_id = p_character_id AND skin_id = p_skin_id;

  RETURN json_build_object('ok', true, 'skin_type', v_skin_type);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. RPC: Buscar skins de um personagem
CREATE OR REPLACE FUNCTION get_character_skins(p_character_id UUID)
RETURNS TABLE (
  skin_id UUID,
  name TEXT,
  description TEXT,
  skin_type TEXT,
  target_id TEXT,
  image_url TEXT,
  sprite_url TEXT,
  equipped BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT sp.id, sp.name, sp.description, sp.skin_type, sp.target_id, sp.image_url, sp.sprite_url, cs.equipped
  FROM character_skins cs
  JOIN skin_products sp ON sp.id = cs.skin_id
  WHERE cs.character_id = p_character_id
  ORDER BY cs.equipped DESC, sp.name ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. RPC: Buscar skin equipada (para overworld/batalha)
CREATE OR REPLACE FUNCTION get_equipped_skin(p_character_id UUID, p_skin_type TEXT)
RETURNS TABLE (
  skin_id UUID,
  name TEXT,
  image_url TEXT,
  sprite_url TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT sp.id, sp.name, sp.image_url, sp.sprite_url
  FROM character_skins cs
  JOIN skin_products sp ON sp.id = cs.skin_id
  WHERE cs.character_id = p_character_id AND sp.skin_type = p_skin_type AND cs.equipped = true
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
