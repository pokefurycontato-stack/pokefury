-- Tabela de zonas de colisão do mapa da cidade
-- Cada zona é um retângulo em coordenadas de pixels

CREATE TABLE IF NOT EXISTS city_collision_zones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pos_x FLOAT NOT NULL,
    pos_y FLOAT NOT NULL,
    width FLOAT NOT NULL,
    height FLOAT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE city_collision_zones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "city_collision_zones_all" ON city_collision_zones FOR ALL USING (true);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_city_collision_zones_pos ON city_collision_zones (pos_x, pos_y);
