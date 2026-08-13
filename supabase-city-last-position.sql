-- ============================================================
-- ULTIMA POSICAO NA CIDADE (por personagem)
-- ============================================================
ALTER TABLE game_saves ADD COLUMN IF NOT EXISTS city_pos_x REAL DEFAULT NULL;
ALTER TABLE game_saves ADD COLUMN IF NOT EXISTS city_pos_y REAL DEFAULT NULL;
