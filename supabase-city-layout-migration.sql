-- Migration: city_layout agora usa coordenadas em PIXELS e scale
-- pos_x, pos_y = posição no mundo em pixels
-- scale = 1.0 = tamanho original da imagem

ALTER TABLE city_layout ADD COLUMN IF NOT EXISTS pos_x FLOAT;
ALTER TABLE city_layout ADD COLUMN IF NOT EXISTS pos_y FLOAT;
ALTER TABLE city_layout ADD COLUMN IF NOT EXISTS scale FLOAT DEFAULT 1.0;

-- Migrar dados antigos: grid_x * 64 -> pos_x, width -> scale
UPDATE city_layout
SET
    pos_x = COALESCE(pos_x, grid_x * 64),
    pos_y = COALESCE(pos_y, grid_y * 64),
    scale = COALESCE(scale, width, 1.0)
WHERE pos_x IS NULL;

ALTER TABLE city_layout ADD COLUMN IF NOT EXISTS layer INTEGER DEFAULT 0;
ALTER TABLE city_layout ADD COLUMN IF NOT EXISTS has_collision BOOLEAN DEFAULT false;
ALTER TABLE city_layout ADD COLUMN IF NOT EXISTS collision_boxes JSONB DEFAULT '[]'::jsonb;
UPDATE city_layout
SET collision_boxes = '[]'::jsonb
WHERE collision_boxes IS NULL;

-- city_players tambem usa pos_x/pos_y em pixels
ALTER TABLE city_players ADD COLUMN IF NOT EXISTS pos_x FLOAT;
ALTER TABLE city_players ADD COLUMN IF NOT EXISTS pos_y FLOAT;
UPDATE city_players
SET
    pos_x = COALESCE(pos_x, grid_x * 64),
    pos_y = COALESCE(pos_y, grid_y * 64)
WHERE pos_x IS NULL;
