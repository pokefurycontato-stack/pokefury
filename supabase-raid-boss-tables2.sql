-- Tabelas extras do Raid Boss (posicao do boss + portal de saida)

CREATE TABLE IF NOT EXISTS city_raid_boss (
  id INTEGER PRIMARY KEY,
  pos_x REAL NOT NULL,
  pos_y REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS city_raid_exit (
  id INTEGER PRIMARY KEY,
  pos_x REAL NOT NULL,
  pos_y REAL NOT NULL
);

ALTER TABLE city_raid_boss ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "city_raid_boss_all" ON city_raid_boss;
CREATE POLICY "city_raid_boss_all" ON city_raid_boss FOR ALL USING (true);

ALTER TABLE city_raid_exit ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "city_raid_exit_all" ON city_raid_exit;
CREATE POLICY "city_raid_exit_all" ON city_raid_exit FOR ALL USING (true);
