CREATE TABLE IF NOT EXISTS city_player_spawn (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  pos_x FLOAT NOT NULL DEFAULT 400,
  pos_y FLOAT NOT NULL DEFAULT 400,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO city_player_spawn (id, pos_x, pos_y) VALUES (1, 400, 400) ON CONFLICT (id) DO NOTHING;

ALTER TABLE city_player_spawn ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "city_spawn_all" ON city_player_spawn;
CREATE POLICY "city_spawn_all" ON city_player_spawn FOR ALL USING (true);
