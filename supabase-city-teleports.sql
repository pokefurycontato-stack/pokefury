-- Tabela de teleports da cidade
-- Cada teleport连接 uma placa (ponto de interação) a um destino

CREATE TABLE IF NOT EXISTS city_teleports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    tag TEXT DEFAULT NULL,
    sign_x FLOAT NOT NULL,
    sign_y FLOAT NOT NULL,
    sign_width FLOAT NOT NULL DEFAULT 64,
    sign_height FLOAT NOT NULL DEFAULT 64,
    dest_x FLOAT NOT NULL,
    dest_y FLOAT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE city_teleports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "city_teleports_all" ON city_teleports;
CREATE POLICY "city_teleports_all" ON city_teleports FOR ALL USING (true);
