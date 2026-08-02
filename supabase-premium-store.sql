-- ============================================================
-- PREMIUM STORE: premium_products table
-- ============================================================

CREATE TABLE IF NOT EXISTS premium_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  price_diamonds INTEGER DEFAULT 0,
  price_brl DECIMAL(10,2) DEFAULT 0,
  image_url TEXT DEFAULT '',
  destination TEXT NOT NULL CHECK (destination IN ('diamond_shop', 'buy_diamonds')),
  active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS: anyone can read active products, only admin can write
ALTER TABLE premium_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active premium products"
  ON premium_products FOR SELECT
  USING (active = true);

CREATE POLICY "Admin can manage premium products"
  ON premium_products FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- Seed: VIP 30 dias na Loja de Diamantes
INSERT INTO premium_products (name, description, price_diamonds, price_brl, image_url, destination, active, sort_order)
VALUES ('VIP 30 Dias', 'Acesso VIP por 30 dias. Benefícios exclusivos!', 20, 0, '', 'diamond_shop', true, 1)
ON CONFLICT DO NOTHING;

-- Ensure character_currencies has diamonds column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'character_currencies' AND column_name = 'diamonds'
  ) THEN
    ALTER TABLE character_currencies ADD COLUMN diamonds INTEGER DEFAULT 0;
  END IF;
END $$;
