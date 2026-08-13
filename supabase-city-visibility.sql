-- ============================================================
-- VISIBILIDADE NA CIDADE: esconder jogadores inativos (AFK)
-- ============================================================
ALTER TABLE city_players ADD COLUMN IF NOT EXISTS is_visible BOOLEAN DEFAULT true;
