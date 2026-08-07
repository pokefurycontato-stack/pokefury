-- Tabela para armazenar o layout da cidade
CREATE TABLE IF NOT EXISTS city_layout (
    id SERIAL PRIMARY KEY,
    asset_id TEXT NOT NULL,
    asset_url TEXT NOT NULL,
    grid_x FLOAT NOT NULL DEFAULT 0,
    grid_y FLOAT NOT NULL DEFAULT 0,
    pos_x FLOAT NOT NULL DEFAULT 0,
    pos_y FLOAT NOT NULL DEFAULT 0,
    scale FLOAT NOT NULL DEFAULT 1.0,
    rotation INTEGER NOT NULL DEFAULT 0,
    z_index INTEGER NOT NULL DEFAULT 0,
    layer INTEGER NOT NULL DEFAULT 0,
    has_collision BOOLEAN NOT NULL DEFAULT false,
    collision_boxes JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE city_layout ENABLE ROW LEVEL SECURITY;
CREATE POLICY "city_layout_select" ON city_layout FOR SELECT USING (true);
CREATE POLICY "city_layout_insert" ON city_layout FOR INSERT WITH CHECK (true);
CREATE POLICY "city_layout_update" ON city_layout FOR UPDATE USING (true);
CREATE POLICY "city_layout_delete" ON city_layout FOR DELETE USING (true);

-- Tabela para posição dos jogadores na cidade
CREATE TABLE IF NOT EXISTS city_players (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    character_name TEXT NOT NULL,
    skin_url TEXT,
    grid_x FLOAT NOT NULL DEFAULT 10,
    grid_y FLOAT NOT NULL DEFAULT 10,
    direction TEXT NOT NULL DEFAULT 'down',
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE city_players ENABLE ROW LEVEL SECURITY;
CREATE POLICY "city_players_select" ON city_players FOR SELECT USING (true);
CREATE POLICY "city_players_insert" ON city_players FOR INSERT WITH CHECK (true);
CREATE POLICY "city_players_update" ON city_players FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "city_players_delete" ON city_players FOR DELETE USING (auth.uid() = user_id);
