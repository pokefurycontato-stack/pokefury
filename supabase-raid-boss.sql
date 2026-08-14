-- ============================================================
-- SISTEMA DE RAID BOSS (portal + arena + ranking + recompensas)
-- ============================================================

-- 1. Boss raid (estado compartilhado)
CREATE TABLE IF NOT EXISTS raid_bosses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pokemon_id INTEGER NOT NULL,
  boss_name TEXT NOT NULL,
  level INTEGER DEFAULT 100,
  max_hp BIGINT DEFAULT 2000000,
  current_hp BIGINT DEFAULT 2000000,
  status TEXT DEFAULT 'active' CHECK (status IN ('active','defeated')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  defeated_at TIMESTAMPTZ
);

-- 2. Dano por jogador
CREATE TABLE IF NOT EXISTS raid_damage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  raid_id UUID NOT NULL REFERENCES raid_bosses(id) ON DELETE CASCADE,
  user_id UUID,
  character_id UUID NOT NULL,
  character_name TEXT,
  total_damage BIGINT DEFAULT 0,
  attacks_count INTEGER DEFAULT 0,
  last_attack_at TIMESTAMPTZ,
  rewarded BOOLEAN DEFAULT false,
  UNIQUE(raid_id, character_id)
);

-- 3. Posicao do portal na cidade
CREATE TABLE IF NOT EXISTS city_raid_portal (
  id INTEGER PRIMARY KEY,
  pos_x REAL NOT NULL,
  pos_y REAL NOT NULL,
  width REAL DEFAULT 64,
  height REAL DEFAULT 64
);

-- 4. Posicao de spawn na arena do boss
CREATE TABLE IF NOT EXISTS city_raid_spawn (
  id INTEGER PRIMARY KEY,
  pos_x REAL NOT NULL,
  pos_y REAL NOT NULL
);

-- 4b. Zonas de raid (onde aparece o ranking lateral)
CREATE TABLE IF NOT EXISTS city_raid_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pos_x REAL NOT NULL,
  pos_y REAL NOT NULL,
  width REAL NOT NULL,
  height REAL NOT NULL
);

-- 5. RLS (leitura publica do estado; escrita via RPC)
ALTER TABLE raid_bosses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "raid_bosses_select" ON raid_bosses;
CREATE POLICY "raid_bosses_select" ON raid_bosses FOR SELECT USING (true);

ALTER TABLE raid_damage ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "raid_damage_select" ON raid_damage;
CREATE POLICY "raid_damage_select" ON raid_damage FOR SELECT USING (true);

-- 6. Realtime (popup de spawn + fim)
ALTER PUBLICATION supabase_realtime ADD TABLE raid_bosses;

-- 7. RPC: spawnar boss (admin)
CREATE OR REPLACE FUNCTION spawn_raid_boss(p_pokemon_id INTEGER, p_name TEXT)
RETURNS JSON AS $$
DECLARE v_boss UUID;
BEGIN
  IF auth.uid() IS NULL OR NOT is_admin_user() THEN
    RETURN json_build_object('error', 'Admin only');
  END IF;
  UPDATE raid_bosses SET status = 'defeated', defeated_at = NOW() WHERE status = 'active';
  INSERT INTO raid_bosses (pokemon_id, boss_name, level, max_hp, current_hp, status)
  VALUES (p_pokemon_id, p_name, 100, 2000000, 2000000, 'active')
  RETURNING id INTO v_boss;
  RETURN json_build_object('ok', true, 'boss_id', v_boss);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. RPC: boss ativo
CREATE OR REPLACE FUNCTION get_active_raid_boss()
RETURNS TABLE (id UUID, pokemon_id INTEGER, boss_name TEXT, level INTEGER, max_hp BIGINT, current_hp BIGINT, status TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT rb.id, rb.pokemon_id, rb.boss_name, rb.level, rb.max_hp, rb.current_hp, rb.status
  FROM raid_bosses rb WHERE rb.status = 'active' ORDER BY rb.created_at DESC LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 9. RPC: ranking de dano
CREATE OR REPLACE FUNCTION get_raid_damage(p_raid_id UUID)
RETURNS TABLE (character_id UUID, character_name TEXT, total_damage BIGINT, attacks_count INTEGER) AS $$
BEGIN
  RETURN QUERY
  SELECT rd.character_id, rd.character_name, rd.total_damage, rd.attacks_count
  FROM raid_damage rd WHERE rd.raid_id = p_raid_id
  ORDER BY rd.total_damage DESC LIMIT 100;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 10. RPC: finalizar boss e entregar recompensas (automatico)
CREATE OR REPLACE FUNCTION finish_raid_boss(p_raid_id UUID)
RETURNS JSON AS $$
DECLARE
  v_participant RECORD;
  v_rank INT := 0;
BEGIN
  UPDATE raid_bosses SET status = 'defeated', defeated_at = NOW() WHERE id = p_raid_id AND status = 'active';

  FOR v_participant IN
    SELECT * FROM raid_damage WHERE raid_id = p_raid_id AND rewarded = false ORDER BY total_damage DESC
  LOOP
    v_rank := v_rank + 1;
    IF v_rank <= 3 THEN
      -- TOP 3: Exp. Share (99) x1 + Rare Candy (40) x10 + 100 ouro
      INSERT INTO player_inventory (user_id, character_id, item_id, quantity)
      VALUES (v_participant.user_id, v_participant.character_id, 99, 1)
      ON CONFLICT (character_id, item_id) DO UPDATE SET quantity = player_inventory.quantity + EXCLUDED.quantity;
      INSERT INTO player_inventory (user_id, character_id, item_id, quantity)
      VALUES (v_participant.user_id, v_participant.character_id, 40, 10)
      ON CONFLICT (character_id, item_id) DO UPDATE SET quantity = player_inventory.quantity + EXCLUDED.quantity;
      INSERT INTO character_currencies (character_id, diamonds, gold, silver)
      VALUES (v_participant.character_id, 0, 100, 0)
      ON CONFLICT (character_id) DO UPDATE SET gold = character_currencies.gold + 100;
    ELSE
      -- Participacao: Rare Candy (40) x3 + 15 ouro
      INSERT INTO player_inventory (user_id, character_id, item_id, quantity)
      VALUES (v_participant.user_id, v_participant.character_id, 40, 3)
      ON CONFLICT (character_id, item_id) DO UPDATE SET quantity = player_inventory.quantity + EXCLUDED.quantity;
      INSERT INTO character_currencies (character_id, diamonds, gold, silver)
      VALUES (v_participant.character_id, 0, 15, 0)
      ON CONFLICT (character_id) DO UPDATE SET gold = character_currencies.gold + 15;
    END IF;
    UPDATE raid_damage SET rewarded = true WHERE id = v_participant.id;
  END LOOP;

  RETURN json_build_object('ok', true, 'participants_rewarded', v_rank);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 11. RPC: registrar dano (e finalizar se o boss morrer)
CREATE OR REPLACE FUNCTION record_raid_damage(
  p_raid_id UUID, p_character_id UUID, p_character_name TEXT, p_damage BIGINT
) RETURNS JSON AS $$
DECLARE
  v_user UUID;
  v_new_hp BIGINT;
  v_status TEXT;
BEGIN
  SELECT gs.user_id INTO v_user FROM game_saves gs WHERE gs.id = p_character_id;
  IF NOT FOUND THEN RETURN json_build_object('error','Character not found'); END IF;
  IF v_user != auth.uid() THEN RETURN json_build_object('error','Unauthorized'); END IF;
  IF p_damage <= 0 THEN RETURN json_build_object('ok', true, 'defeated', false); END IF;

  SELECT status INTO v_status FROM raid_bosses WHERE id = p_raid_id;
  IF v_status IS NULL OR v_status != 'active' THEN
    RETURN json_build_object('error','Raid finalizada');
  END IF;

  INSERT INTO raid_damage (raid_id, user_id, character_id, character_name, total_damage, attacks_count, last_attack_at)
  VALUES (p_raid_id, v_user, p_character_id, p_character_name, p_damage, 1, NOW())
  ON CONFLICT (raid_id, character_id) DO UPDATE SET
    total_damage = raid_damage.total_damage + EXCLUDED.total_damage,
    attacks_count = raid_damage.attacks_count + 1,
    last_attack_at = NOW();

  UPDATE raid_bosses SET current_hp = GREATEST(0, current_hp - p_damage) WHERE id = p_raid_id;
  SELECT current_hp INTO v_new_hp FROM raid_bosses WHERE id = p_raid_id;

  IF v_new_hp <= 0 THEN
    PERFORM finish_raid_boss(p_raid_id);
    RETURN json_build_object('ok', true, 'defeated', true);
  END IF;

  RETURN json_build_object('ok', true, 'defeated', false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
