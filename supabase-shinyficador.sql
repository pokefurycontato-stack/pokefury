-- ============================================================
-- SHINYFICADOR - item que transforma pokemon normal em shiny
-- ============================================================

-- Item no inventário
INSERT INTO items (id, name, category, subcategory, effect, effect_value, description, price, sprite_url, holdable, usable_in_battle)
VALUES (5000, 'Shinyficador', 'field', 'shiny', 'make_shiny', 0, 'Transforma um Pokemon normal em Shiny.', 0, 'assets/ferramentas/shinyficador.png', false, false)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  subcategory = EXCLUDED.subcategory,
  effect = EXCLUDED.effect,
  effect_value = EXCLUDED.effect_value,
  description = EXCLUDED.description,
  price = EXCLUDED.price,
  sprite_url = EXCLUDED.sprite_url,
  holdable = EXCLUDED.holdable,
  usable_in_battle = EXCLUDED.usable_in_battle;

-- Produto na loja de diamantes
DELETE FROM premium_products WHERE name = 'Shinyficador';
INSERT INTO premium_products (name, description, price_diamonds, price_brl, image_url, destination, active, sort_order)
VALUES ('Shinyficador', 'Transforma um Pokemon normal em Shiny.', 100, 0, 'assets/ferramentas/shinyficador.png', 'diamond_shop', true, 6);

SELECT 'Shinyficador installed' AS status;
