-- Adicionar sistema de layers à cidade
ALTER TABLE city_layout ADD COLUMN IF NOT EXISTS layer INTEGER DEFAULT 0;
