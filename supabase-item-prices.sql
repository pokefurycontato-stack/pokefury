-- Atualizar preços dos held items no banco (controlados pelo servidor)
UPDATE items SET price = 4000 WHERE id = 201;
UPDATE items SET price = 10000 WHERE id IN (202,203,204,205,210);
UPDATE items SET price = 5000 WHERE id IN (206,219,220,224,225);
UPDATE items SET price = 8000 WHERE id IN (207,208,211);
UPDATE items SET price = 6000 WHERE id = 209;
UPDATE items SET price = 3000 WHERE id IN (212,223,226,264);
UPDATE items SET price = 3200 WHERE id IN (213,214,215,216,217,218);
UPDATE items SET price = 4000 WHERE id IN (221,222,258,259,260);
UPDATE items SET price = 1500 WHERE id IN (227,228);
UPDATE items SET price = 1000 WHERE id = 229;
UPDATE items SET price = 1200 WHERE id IN (230,231,232,233,234,235,236,237,238,239,240,241,242,243,244,245);
UPDATE items SET price = 2000 WHERE id IN (248,249,250,251,252,253,254,255,256,257,261,262,263);

-- RPC de compra atomica (valida preço no servidor + desconta + adiciona item)
CREATE OR REPLACE FUNCTION buy_item(
  p_character_id UUID,
  p_item_id INTEGER,
  p_quantity INTEGER DEFAULT 1
) RETURNS JSONB AS $$
DECLARE
  v_user_id UUID;
  v_price INTEGER;
  v_total INTEGER;
  v_balance INTEGER;
  v_row RECORD;
  v_new_balance INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('error', 'Not authenticated'); END IF;
  SELECT gs.user_id INTO v_user_id FROM game_saves gs WHERE gs.id = p_character_id;
  IF NOT FOUND OR v_user_id != auth.uid() THEN RETURN jsonb_build_object('error', 'Not authorized'); END IF;

  IF p_quantity <= 0 OR p_quantity > 99 THEN RETURN jsonb_build_object('error', 'Invalid quantity'); END IF;

  -- Preço REAL do item (controlado pelo servidor)
  SELECT price INTO v_price FROM items WHERE id = p_item_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'Item not found'); END IF;
  IF v_price <= 0 THEN RETURN jsonb_build_object('error', 'Item not purchasable'); END IF;

  v_total := v_price * p_quantity;

  -- Bloqueia e checa saldo
  SELECT * INTO v_row FROM character_currencies WHERE character_id = p_character_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'No currency balance'); END IF;
  IF v_row.silver < v_total THEN RETURN jsonb_build_object('error', 'Insufficient balance'); END IF;

  -- Desconta prata
  v_new_balance := v_row.silver - v_total;
  UPDATE character_currencies SET silver = v_new_balance WHERE character_id = p_character_id;

  -- Registra no audit log
  INSERT INTO currency_audit_log (character_id, user_id, action, currency_type, amount, balance_before, balance_after, description, created_by)
  VALUES (p_character_id, auth.uid(), 'purchase', 'silver', -v_total, v_row.silver, v_new_balance, 'PokeMart: ' || p_quantity || 'x item #' || p_item_id, NULL);

  -- Adiciona item ao inventário
  INSERT INTO player_inventory (user_id, character_id, item_id, quantity)
  VALUES (auth.uid(), p_character_id, p_item_id, p_quantity)
  ON CONFLICT (character_id, item_id) DO UPDATE
  SET quantity = player_inventory.quantity + EXCLUDED.quantity
  WHERE player_inventory.quantity + EXCLUDED.quantity <= 9999;

  RETURN jsonb_build_object('success', true, 'price', v_price, 'total', v_total, 'balance', v_new_balance);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

SELECT 'Item prices + buy_item RPC installed' AS status;
