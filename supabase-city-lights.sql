-- City lights (lamps/posts glow at night)
CREATE TABLE IF NOT EXISTS city_lights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pos_x FLOAT NOT NULL,
  pos_y FLOAT NOT NULL,
  radius FLOAT DEFAULT 120,
  color TEXT DEFAULT '#ffddaa',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE city_lights ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "city_lights_all" ON city_lights;
CREATE POLICY "city_lights_all" ON city_lights FOR ALL USING (true);
