-- Caixas de colisão manuais por asset (frações 0-1 da imagem)
-- Ex: [{x:0, y:0.3, w:0.2, h:0.7}, {x:0.8, y:0.3, w:0.2, h:0.7}]
-- Se vazio e has_collision=true, usa colisão no PNG inteiro (fallback)
ALTER TABLE city_layout ADD COLUMN IF NOT EXISTS collision_boxes JSONB DEFAULT '[]';
