-- ============================================================
-- CURRENCY SECURITY SYSTEM
-- All currency changes MUST go through RPC functions
-- Direct updates to character_currencies are blocked
-- ============================================================

-- 1. AUDIT LOG TABLE
CREATE TABLE IF NOT EXISTS currency_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id UUID NOT NULL REFERENCES game_saves(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL CHECK (action IN ('donate', 'purchase', 'reward', 'spend', 'refund', 'admin_grant')),
  currency_type TEXT NOT NULL CHECK (currency_type IN ('diamonds', 'gold', 'silver')),
  amount INTEGER NOT NULL,
  balance_before INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  description TEXT DEFAULT '',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE currency_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own audit logs"
  ON currency_audit_log FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "System can insert audit logs"
  ON currency_audit_log FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admin can read all audit logs"
  ON currency_audit_log FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

CREATE INDEX IF NOT EXISTS idx_audit_character ON currency_audit_log(character_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON currency_audit_log(created_at DESC);

-- 2. SAFE ADD CURRENCY FUNCTION (used by admin donate, battle rewards, etc)
CREATE OR REPLACE FUNCTION add_currency(
  p_character_id UUID,
  p_currency_type TEXT,
  p_amount INTEGER,
  p_action TEXT,
  p_description TEXT DEFAULT '',
  p_created_by UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_current INTEGER;
  v_new INTEGER;
  v_row RECORD;
BEGIN
  -- Validate
  IF p_amount < 0 THEN
    RETURN jsonb_build_object('error', 'Amount must be positive');
  END IF;

  IF p_currency_type NOT IN ('diamonds', 'gold', 'silver') THEN
    RETURN jsonb_build_object('error', 'Invalid currency type');
  END IF;

  -- Get or create currency row
  INSERT INTO character_currencies (character_id, diamonds, gold, silver)
  VALUES (p_character_id,
    CASE WHEN p_currency_type = 'diamonds' THEN p_amount ELSE 0 END,
    CASE WHEN p_currency_type = 'gold' THEN p_amount ELSE 0 END,
    CASE WHEN p_currency_type = 'silver' THEN p_amount ELSE 0 END
  )
  ON CONFLICT (character_id) DO NOTHING;

  -- Lock row and get current balance
  SELECT * INTO v_row FROM character_currencies
  WHERE character_id = p_character_id FOR UPDATE;

  -- Get current value
  v_current := CASE p_currency_type
    WHEN 'diamonds' THEN v_row.diamonds
    WHEN 'gold' THEN v_row.gold
    WHEN 'silver' THEN v_row.silver
  END;

  v_new := v_current + p_amount;

  -- Update balance
  CASE p_currency_type
    WHEN 'diamonds' THEN
      UPDATE character_currencies SET diamonds = v_new WHERE character_id = p_character_id;
    WHEN 'gold' THEN
      UPDATE character_currencies SET gold = v_new WHERE character_id = p_character_id;
    WHEN 'silver' THEN
      UPDATE character_currencies SET silver = v_new WHERE character_id = p_character_id;
  END CASE;

  -- Audit log
  INSERT INTO currency_audit_log (character_id, user_id, action, currency_type, amount, balance_before, balance_after, description, created_by)
  SELECT p_character_id, gs.user_id, p_action, p_currency_type, p_amount, v_current, v_new, p_description, p_created_by
  FROM game_saves gs WHERE gs.id = p_character_id;

  RETURN jsonb_build_object('success', true, 'balance', v_new);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. SAFE SPEND CURRENCY FUNCTION (used by premium store purchases)
CREATE OR REPLACE FUNCTION spend_currency(
  p_character_id UUID,
  p_currency_type TEXT,
  p_amount INTEGER,
  p_action TEXT,
  p_description TEXT DEFAULT '',
  p_created_by UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_current INTEGER;
  v_new INTEGER;
  v_row RECORD;
BEGIN
  IF p_amount <= 0 THEN
    RETURN jsonb_build_object('error', 'Amount must be positive');
  END IF;

  IF p_currency_type NOT IN ('diamonds', 'gold', 'silver') THEN
    RETURN jsonb_build_object('error', 'Invalid currency type');
  END IF;

  -- Lock row and get current balance
  SELECT * INTO v_row FROM character_currencies
  WHERE character_id = p_character_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Character not found');
  END IF;

  v_current := CASE p_currency_type
    WHEN 'diamonds' THEN v_row.diamonds
    WHEN 'gold' THEN v_row.gold
    WHEN 'silver' THEN v_row.silver
  END;

  IF v_current < p_amount THEN
    RETURN jsonb_build_object('error', 'Insufficient balance');
  END IF;

  v_new := v_current - p_amount;

  CASE p_currency_type
    WHEN 'diamonds' THEN
      UPDATE character_currencies SET diamonds = v_new WHERE character_id = p_character_id;
    WHEN 'gold' THEN
      UPDATE character_currencies SET gold = v_new WHERE character_id = p_character_id;
    WHEN 'silver' THEN
      UPDATE character_currencies SET silver = v_new WHERE character_id = p_character_id;
  END CASE;

  -- Audit log
  INSERT INTO currency_audit_log (character_id, user_id, action, currency_type, amount, balance_before, balance_after, description, created_by)
  SELECT p_character_id, gs.user_id, p_action, p_currency_type, -p_amount, v_current, v_new, p_description, p_created_by
  FROM game_saves gs WHERE gs.id = p_character_id;

  RETURN jsonb_build_object('success', true, 'balance', v_new);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. GET CURRENCY BALANCE (safe read)
CREATE OR REPLACE FUNCTION get_currency_balance(
  p_character_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_row RECORD;
BEGIN
  SELECT diamonds, gold, silver INTO v_row
  FROM character_currencies
  WHERE character_id = p_character_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('diamonds', 0, 'gold', 0, 'silver', 0);
  END IF;

  RETURN jsonb_build_object(
    'diamonds', v_row.diamonds,
    'gold', v_row.gold,
    'silver', v_row.silver
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. BLOCK direct updates (only allow via RPC)
-- Remove existing policies
DROP POLICY IF EXISTS "currency_select" ON character_currencies;
DROP POLICY IF EXISTS "currency_insert" ON character_currencies;
DROP POLICY IF EXISTS "currency_update" ON character_currencies;
DROP POLICY IF EXISTS "Admin can manage all currencies" ON character_currencies;

-- New restrictive policies
CREATE POLICY "currency_select_safe" ON character_currencies
  FOR SELECT USING (
    character_id IN (SELECT id FROM game_saves WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- Block direct INSERT (must use add_currency RPC)
CREATE POLICY "block_direct_insert" ON character_currencies
  FOR INSERT WITH CHECK (false);

-- Block direct UPDATE (must use RPC functions)
CREATE POLICY "block_direct_update" ON character_currencies
  FOR UPDATE USING (false);

-- Block direct DELETE
CREATE POLICY "block_direct_delete" ON character_currencies
  FOR DELETE USING (false);

-- 6. CONSTRAINT: currencies can never go negative
ALTER TABLE character_currencies DROP CONSTRAINT IF EXISTS check_diamonds_positive;
ALTER TABLE character_currencies DROP CONSTRAINT IF EXISTS check_gold_positive;
ALTER TABLE character_currencies DROP CONSTRAINT IF EXISTS check_silver_positive;

ALTER TABLE character_currencies ADD CONSTRAINT check_diamonds_positive CHECK (diamonds >= 0);
ALTER TABLE character_currencies ADD CONSTRAINT check_gold_positive CHECK (gold >= 0);
ALTER TABLE character_currencies ADD CONSTRAINT check_silver_positive CHECK (silver >= 0);

-- 7. Ensure unique constraint exists for ON CONFLICT
DO $$ BEGIN
  ALTER TABLE character_currencies ADD CONSTRAINT character_currencies_character_id_key UNIQUE (character_id);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
