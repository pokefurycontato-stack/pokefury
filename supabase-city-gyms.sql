-- ============================================================
-- GINASIOS NA CIDADE (zonas por elemento + teleportes + NPC)
-- ============================================================

-- Zona do ginasio de cada elemento
CREATE TABLE IF NOT EXISTS city_gym_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_type TEXT UNIQUE NOT NULL,
  pos_x REAL NOT NULL,
  pos_y REAL NOT NULL,
  width REAL NOT NULL,
  height REAL NOT NULL
);

-- Teleporte de cada elemento (ao lado da zona)
CREATE TABLE IF NOT EXISTS city_gym_teleports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_type TEXT UNIQUE NOT NULL,
  pos_x REAL NOT NULL,
  pos_y REAL NOT NULL
);

-- Posicao do NPC de ginasios
CREATE TABLE IF NOT EXISTS city_gym_npc (
  id INTEGER PRIMARY KEY,
  pos_x REAL NOT NULL,
  pos_y REAL NOT NULL
);

-- RLS (leitura publica; escrita liberada para o builder)
ALTER TABLE city_gym_zones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "city_gym_zones_all" ON city_gym_zones;
CREATE POLICY "city_gym_zones_all" ON city_gym_zones FOR ALL USING (true);

ALTER TABLE city_gym_teleports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "city_gym_teleports_all" ON city_gym_teleports;
CREATE POLICY "city_gym_teleports_all" ON city_gym_teleports FOR ALL USING (true);

ALTER TABLE city_gym_npc ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "city_gym_npc_all" ON city_gym_npc;
CREATE POLICY "city_gym_npc_all" ON city_gym_npc FOR ALL USING (true);
