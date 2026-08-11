-- ============================================================
-- AUCTION SYSTEM - Compra e Venda de Pokemon entre Jogadores
-- ============================================================

CREATE TABLE IF NOT EXISTS auction_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_character_id UUID NOT NULL REFERENCES game_saves(id) ON DELETE CASCADE,
  seller_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  seller_name TEXT DEFAULT 'Treinador',
  pokemon_source TEXT NOT NULL CHECK (pokemon_source IN ('team', 'pc')),
  pokemon_source_id UUID NOT NULL,
  pokemon_id INTEGER NOT NULL,
  pokemon_name TEXT NOT NULL,
  species TEXT NOT NULL,
  level INTEGER NOT NULL DEFAULT 1,
  current_hp INTEGER DEFAULT 0,
  stats_hp INTEGER DEFAULT 0,
  stats_attack INTEGER DEFAULT 0,
  stats_defense INTEGER DEFAULT 0,
  stats_sp_atk INTEGER DEFAULT 0,
  stats_sp_def INTEGER DEFAULT 0,
  stats_speed INTEGER DEFAULT 0,
  iv_hp INTEGER DEFAULT 15,
  iv_attack INTEGER DEFAULT 15,
  iv_defense INTEGER DEFAULT 15,
  iv_sp_atk INTEGER DEFAULT 15,
  iv_sp_def INTEGER DEFAULT 15,
  iv_speed INTEGER DEFAULT 15,
  ev_hp INTEGER DEFAULT 0,
  ev_attack INTEGER DEFAULT 0,
  ev_defense INTEGER DEFAULT 0,
  ev_sp_atk INTEGER DEFAULT 0,
  ev_sp_def INTEGER DEFAULT 0,
  ev_speed INTEGER DEFAULT 0,
  nature TEXT DEFAULT 'hardy',
  ability_name TEXT,
  moves JSONB DEFAULT '[]'::jsonb,
  types TEXT DEFAULT '',
  is_shiny BOOLEAN DEFAULT false,
  happiness INTEGER DEFAULT 70,
  experience INTEGER DEFAULT 0,
  held_item_id INTEGER,
  price INTEGER NOT NULL CHECK (price > 0),
  currency_type TEXT NOT NULL CHECK (currency_type IN ('silver', 'gold', 'diamonds')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'sold', 'cancelled')),
  buyer_character_id UUID REFERENCES game_saves(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auction_active ON auction_offers(status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_auction_seller ON auction_offers(seller_character_id);
CREATE INDEX IF NOT EXISTS idx_auction_pokemon ON auction_offers(pokemon_id);

ALTER TABLE auction_offers ADD COLUMN IF NOT EXISTS seller_name TEXT DEFAULT 'Treinador';

ALTER TABLE auction_offers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auction_select" ON auction_offers;
CREATE POLICY "auction_select" ON auction_offers FOR SELECT USING (true);

DROP POLICY IF EXISTS "auction_block_insert" ON auction_offers;
CREATE POLICY "auction_block_insert" ON auction_offers FOR INSERT WITH CHECK (false);

DROP POLICY IF EXISTS "auction_block_update" ON auction_offers;
CREATE POLICY "auction_block_update" ON auction_offers FOR UPDATE USING (false);

DROP POLICY IF EXISTS "auction_block_delete" ON auction_offers;
CREATE POLICY "auction_block_delete" ON auction_offers FOR DELETE USING (false);

-- Enable realtime for auction updates
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE auction_offers;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
ALTER TABLE auction_offers REPLICA IDENTITY FULL;

-- ============================================================
-- RPC: Create auction offer (sell pokemon)
-- ============================================================
CREATE OR REPLACE FUNCTION auction_create_offer(
  p_character_id UUID,
  p_pokemon_source TEXT,
  p_pokemon_source_id UUID,
  p_price INTEGER,
  p_currency_type TEXT
) RETURNS JSONB AS $$
DECLARE
  v_owner_user_id UUID;
  v_new_id UUID;
  v_t RECORD;
  v_pc RECORD;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('error', 'Not authenticated'); END IF;
  SELECT gs.user_id INTO v_owner_user_id FROM game_saves gs WHERE gs.id = p_character_id;
  IF NOT FOUND OR v_owner_user_id != auth.uid() THEN RETURN jsonb_build_object('error', 'Not authorized'); END IF;
  IF p_price <= 0 THEN RETURN jsonb_build_object('error', 'Price must be positive'); END IF;
  IF p_currency_type NOT IN ('silver', 'gold', 'diamonds') THEN RETURN jsonb_build_object('error', 'Invalid currency'); END IF;

  IF p_pokemon_source = 'team' THEN
    SELECT * INTO v_t FROM pokemon_team WHERE id = p_pokemon_source_id AND user_id = auth.uid() FOR UPDATE;
    IF NOT FOUND THEN RETURN jsonb_build_object('error', 'Pokemon not found in team'); END IF;
    DELETE FROM pokemon_team WHERE id = p_pokemon_source_id;
    INSERT INTO auction_offers (seller_character_id,seller_user_id,seller_name,pokemon_source,pokemon_source_id,pokemon_id,pokemon_name,species,level,current_hp,stats_hp,stats_attack,stats_defense,stats_sp_atk,stats_sp_def,stats_speed,iv_hp,iv_attack,iv_defense,iv_sp_atk,iv_sp_def,iv_speed,ev_hp,ev_attack,ev_defense,ev_sp_atk,ev_sp_def,ev_speed,nature,ability_name,moves,types,is_shiny,happiness,experience,held_item_id,price,currency_type,status)
    VALUES (p_character_id,auth.uid(),(SELECT player_name FROM game_saves WHERE id = p_character_id),'team',p_pokemon_source_id,COALESCE(v_t.pokemon_id,0),v_t.species,v_t.species,v_t.level,COALESCE(v_t.current_hp,0),0,0,0,0,0,0,COALESCE(v_t.iv_hp,15),COALESCE(v_t.iv_attack,15),COALESCE(v_t.iv_defense,15),COALESCE(v_t.iv_sp_atk,15),COALESCE(v_t.iv_sp_def,15),COALESCE(v_t.iv_speed,15),COALESCE(v_t.ev_hp,0),COALESCE(v_t.ev_attack,0),COALESCE(v_t.ev_defense,0),COALESCE(v_t.ev_sp_atk,0),COALESCE(v_t.ev_sp_def,0),COALESCE(v_t.ev_speed,0),COALESCE(v_t.nature,'hardy'),NULL,'[]'::jsonb,'',COALESCE(v_t.is_shiny,false),COALESCE(v_t.happiness,70),COALESCE(v_t.experience,0),v_t.held_item_id,p_price,p_currency_type,'active')
    RETURNING id INTO v_new_id;
    RETURN jsonb_build_object('success',true,'offer_id',v_new_id,'pokemon_name',v_t.species,'price',p_price,'currency',p_currency_type);
  ELSIF p_pokemon_source = 'pc' THEN
    SELECT * INTO v_pc FROM pokemon_pc WHERE id = p_pokemon_source_id AND user_id = auth.uid() FOR UPDATE;
    IF NOT FOUND THEN RETURN jsonb_build_object('error', 'Pokemon not found in PC'); END IF;
    DELETE FROM pokemon_pc WHERE id = p_pokemon_source_id;
    INSERT INTO auction_offers (seller_character_id,seller_user_id,seller_name,pokemon_source,pokemon_source_id,pokemon_id,pokemon_name,species,level,current_hp,stats_hp,stats_attack,stats_defense,stats_sp_atk,stats_sp_def,stats_speed,iv_hp,iv_attack,iv_defense,iv_sp_atk,iv_sp_def,iv_speed,ev_hp,ev_attack,ev_defense,ev_sp_atk,ev_sp_def,ev_speed,nature,ability_name,moves,types,is_shiny,happiness,experience,held_item_id,price,currency_type,status)
    VALUES (p_character_id,auth.uid(),(SELECT player_name FROM game_saves WHERE id = p_character_id),'pc',p_pokemon_source_id,COALESCE(v_pc.pokemon_id,0),v_pc.species,v_pc.species,v_pc.level,COALESCE(v_pc.current_hp,0),0,0,0,0,0,0,COALESCE(v_pc.iv_hp,15),COALESCE(v_pc.iv_attack,15),COALESCE(v_pc.iv_defense,15),COALESCE(v_pc.iv_sp_atk,15),COALESCE(v_pc.iv_sp_def,15),COALESCE(v_pc.iv_speed,15),COALESCE(v_pc.ev_hp,0),COALESCE(v_pc.ev_attack,0),COALESCE(v_pc.ev_defense,0),COALESCE(v_pc.ev_sp_atk,0),COALESCE(v_pc.ev_sp_def,0),COALESCE(v_pc.ev_speed,0),COALESCE(v_pc.nature,'hardy'),NULL,'[]'::jsonb,'',COALESCE(v_pc.is_shiny,false),COALESCE(v_pc.happiness,70),COALESCE(v_pc.experience,0),v_pc.held_item_id,p_price,p_currency_type,'active')
    RETURNING id INTO v_new_id;
    RETURN jsonb_build_object('success',true,'offer_id',v_new_id,'pokemon_name',v_pc.species,'price',p_price,'currency',p_currency_type);
  ELSE
    RETURN jsonb_build_object('error', 'Invalid source type');
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================
-- RPC: Buy auction offer
-- ============================================================
CREATE OR REPLACE FUNCTION auction_buy_offer(
  p_character_id UUID,
  p_offer_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_owner_user_id UUID;
  v_offer RECORD;
  v_team_count INTEGER;
  v_new_id UUID;
  v_box INT;
  v_slot INT;
  v_stored BOOLEAN := false;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  SELECT gs.user_id INTO v_owner_user_id FROM game_saves gs WHERE gs.id = p_character_id;
  IF NOT FOUND OR v_owner_user_id != auth.uid() THEN
    RETURN jsonb_build_object('error', 'Not authorized');
  END IF;

  -- Lock and verify offer
  SELECT * INTO v_offer FROM auction_offers WHERE id = p_offer_id AND status = 'active' FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Offer not available');
  END IF;

  -- Cannot buy own offer
  IF v_offer.seller_user_id = auth.uid() THEN
    RETURN jsonb_build_object('error', 'Cannot buy your own offer');
  END IF;

  -- Check buyer has enough currency
  DECLARE
    v_balance INTEGER;
    v_row RECORD;
  BEGIN
    SELECT * INTO v_row FROM character_currencies WHERE character_id = p_character_id FOR UPDATE;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('error', 'No currency balance');
    END IF;
    v_balance := CASE v_offer.currency_type
      WHEN 'diamonds' THEN v_row.diamonds
      WHEN 'gold' THEN v_row.gold
      WHEN 'silver' THEN v_row.silver
    END;
    IF v_balance < v_offer.price THEN
      RETURN jsonb_build_object('error', 'Insufficient balance');
    END IF;
  END;

  -- Deduct from buyer
  PERFORM spend_currency(p_character_id, v_offer.currency_type, v_offer.price, 'purchase', 'Auction purchase: ' || v_offer.pokemon_name);

  -- Credit seller
  PERFORM add_currency(v_offer.seller_character_id, v_offer.currency_type, v_offer.price, 'reward', 'Auction sale: ' || v_offer.pokemon_name);

  -- Try to add to buyer's team
  SELECT COUNT(*) INTO v_team_count FROM pokemon_team WHERE user_id = auth.uid();
  IF v_team_count < 6 THEN
    INSERT INTO pokemon_team (
      user_id, character_id, pokemon_id, pokemon_name, species, types,
      level, current_hp, stats_hp, stats_attack, stats_defense,
      stats_sp_atk, stats_sp_def, stats_speed,
      iv_hp, iv_attack, iv_defense, iv_sp_atk, iv_sp_def, iv_speed,
      ev_hp, ev_attack, ev_defense, ev_sp_atk, ev_sp_def, ev_speed,
      nature, happiness, is_shiny, held_item_id, experience, slot
    ) VALUES (
      auth.uid(), p_character_id, v_offer.pokemon_id, v_offer.pokemon_name, v_offer.species, v_offer.types,
      v_offer.level, COALESCE(v_offer.current_hp, v_offer.stats_hp), v_offer.stats_hp, v_offer.stats_attack, v_offer.stats_defense,
      v_offer.stats_sp_atk, v_offer.stats_sp_def, v_offer.stats_speed,
      v_offer.iv_hp, v_offer.iv_attack, v_offer.iv_defense, v_offer.iv_sp_atk, v_offer.iv_sp_def, v_offer.iv_speed,
      v_offer.ev_hp, v_offer.ev_attack, v_offer.ev_defense, v_offer.ev_sp_atk, v_offer.ev_sp_def, v_offer.ev_speed,
      v_offer.nature, v_offer.happiness, v_offer.is_shiny, v_offer.held_item_id, v_offer.experience, v_team_count + 1
    )
    RETURNING id INTO v_new_id;
  ELSE
    -- Store in PC
    FOR v_box IN 1..20 LOOP
      FOR v_slot IN 0..29 LOOP
        IF NOT EXISTS(SELECT 1 FROM pokemon_pc WHERE character_id = p_character_id AND box_number = v_box AND slot_index = v_slot) THEN
          INSERT INTO pokemon_pc (user_id, character_id, box_number, slot_index, species, nickname, level, current_hp, max_hp, experience, pokemon_id, iv_hp, iv_attack, iv_defense, iv_sp_atk, iv_sp_def, iv_speed, ev_hp, ev_attack, ev_defense, ev_sp_atk, ev_sp_def, ev_speed, nature, happiness, is_shiny, held_item_id)
          VALUES (auth.uid(), p_character_id, v_box, v_slot, v_offer.species, v_offer.pokemon_name, v_offer.level, COALESCE(v_offer.current_hp, v_offer.stats_hp), v_offer.stats_hp, v_offer.experience, v_offer.pokemon_id, v_offer.iv_hp, v_offer.iv_attack, v_offer.iv_defense, v_offer.iv_sp_atk, v_offer.iv_sp_def, v_offer.iv_speed, v_offer.ev_hp, v_offer.ev_attack, v_offer.ev_defense, v_offer.ev_sp_atk, v_offer.ev_sp_def, v_offer.ev_speed, v_offer.nature, v_offer.happiness, v_offer.is_shiny, v_offer.held_item_id)
          RETURNING id INTO v_new_id;
          v_stored := true;
          EXIT;
        END IF;
      END LOOP;
      IF v_stored THEN EXIT; END IF;
    END LOOP;
    IF NOT v_stored THEN
      -- Refund buyer
      PERFORM add_currency(p_character_id, v_offer.currency_type, v_offer.price, 'refund', 'PC full, refund for: ' || v_offer.pokemon_name);
      RETURN jsonb_build_object('error', 'Team and PC are full');
    END IF;
  END IF;

  -- Mark as sold
  UPDATE auction_offers SET status = 'sold', buyer_character_id = p_character_id, updated_at = NOW() WHERE id = p_offer_id;

  RETURN jsonb_build_object(
    'success', true,
    'pokemon_name', v_offer.pokemon_name,
    'price', v_offer.price,
    'currency', v_offer.currency_type,
    'stored_in_pc', v_team_count >= 6,
    'team_id', v_new_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================
-- RPC: Cancel own offer
-- ============================================================
CREATE OR REPLACE FUNCTION auction_cancel_offer(
  p_character_id UUID,
  p_offer_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_owner_user_id UUID;
  v_offer RECORD;
  v_box INT;
  v_slot INT;
  v_team_count INTEGER;
  v_new_id UUID;
  v_stored BOOLEAN := false;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  SELECT gs.user_id INTO v_owner_user_id FROM game_saves gs WHERE gs.id = p_character_id;
  IF NOT FOUND OR v_owner_user_id != auth.uid() THEN
    RETURN jsonb_build_object('error', 'Not authorized');
  END IF;

  SELECT * INTO v_offer FROM auction_offers WHERE id = p_offer_id AND status = 'active' AND seller_user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Offer not found or not yours');
  END IF;

  -- Try to return to team
  SELECT COUNT(*) INTO v_team_count FROM pokemon_team WHERE user_id = auth.uid();
  IF v_team_count < 6 THEN
    INSERT INTO pokemon_team (
      user_id, character_id, pokemon_id, pokemon_name, species, types,
      level, current_hp, stats_hp, stats_attack, stats_defense,
      stats_sp_atk, stats_sp_def, stats_speed,
      iv_hp, iv_attack, iv_defense, iv_sp_atk, iv_sp_def, iv_speed,
      ev_hp, ev_attack, ev_defense, ev_sp_atk, ev_sp_def, ev_speed,
      nature, happiness, is_shiny, held_item_id, experience, slot
    ) VALUES (
      auth.uid(), p_character_id, v_offer.pokemon_id, v_offer.pokemon_name, v_offer.species, v_offer.types,
      v_offer.level, COALESCE(v_offer.current_hp, v_offer.stats_hp), v_offer.stats_hp, v_offer.stats_attack, v_offer.stats_defense,
      v_offer.stats_sp_atk, v_offer.stats_sp_def, v_offer.stats_speed,
      v_offer.iv_hp, v_offer.iv_attack, v_offer.iv_defense, v_offer.iv_sp_atk, v_offer.iv_sp_def, v_offer.iv_speed,
      v_offer.ev_hp, v_offer.ev_attack, v_offer.ev_defense, v_offer.ev_sp_atk, v_offer.ev_sp_def, v_offer.ev_speed,
      v_offer.nature, v_offer.happiness, v_offer.is_shiny, v_offer.held_item_id, v_offer.experience, v_team_count + 1
    )
    RETURNING id INTO v_new_id;
  ELSE
    FOR v_box IN 1..20 LOOP
      FOR v_slot IN 0..29 LOOP
        IF NOT EXISTS(SELECT 1 FROM pokemon_pc WHERE character_id = p_character_id AND box_number = v_box AND slot_index = v_slot) THEN
          INSERT INTO pokemon_pc (user_id, character_id, box_number, slot_index, species, nickname, level, current_hp, max_hp, experience, pokemon_id, iv_hp, iv_attack, iv_defense, iv_sp_atk, iv_sp_def, iv_speed, ev_hp, ev_attack, ev_defense, ev_sp_atk, ev_sp_def, ev_speed, nature, happiness, is_shiny, held_item_id)
          VALUES (auth.uid(), p_character_id, v_box, v_slot, v_offer.species, v_offer.pokemon_name, v_offer.level, COALESCE(v_offer.current_hp, v_offer.stats_hp), v_offer.stats_hp, v_offer.experience, v_offer.pokemon_id, v_offer.iv_hp, v_offer.iv_attack, v_offer.iv_defense, v_offer.iv_sp_atk, v_offer.iv_sp_def, v_offer.iv_speed, v_offer.ev_hp, v_offer.ev_attack, v_offer.ev_defense, v_offer.ev_sp_atk, v_offer.ev_sp_def, v_offer.ev_speed, v_offer.nature, v_offer.happiness, v_offer.is_shiny, v_offer.held_item_id)
          RETURNING id INTO v_new_id;
          v_stored := true;
          EXIT;
        END IF;
      END LOOP;
      IF v_stored THEN EXIT; END IF;
    END LOOP;
    IF NOT v_stored THEN
      RETURN jsonb_build_object('error', 'Team and PC are full - cannot cancel');
    END IF;
  END IF;

  UPDATE auction_offers SET status = 'cancelled', updated_at = NOW() WHERE id = p_offer_id;

  RETURN jsonb_build_object('success', true, 'pokemon_name', v_offer.pokemon_name);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

SELECT 'Auction system installed successfully' AS status;
