-- Adicionar colisão aos assets da cidade
ALTER TABLE city_layout ADD COLUMN IF NOT EXISTS has_collision BOOLEAN DEFAULT false;
