-- ============================================================
-- PokeFury - Cidade: ocultar sprites inativos (admin/todos)
-- Rodar inteiro no Supabase SQL Editor (é idempotente).
--
-- 1. Garante coluna updated_at em city_players
-- 2. Trigger que atualiza updated_at em QUALQUER UPDATE da linha
--    (movimento, heartbeat). Assim a renderização pode filtrar
--    sprites por updated_at e ignorar is_visible travado.
-- ============================================================

ALTER TABLE city_players ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

CREATE OR REPLACE FUNCTION set_city_players_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS city_players_touch_updated_at ON city_players;
CREATE TRIGGER city_players_touch_updated_at
  BEFORE UPDATE ON city_players
  FOR EACH ROW
  EXECUTE FUNCTION set_city_players_updated_at();

SELECT 'city_players updated_at trigger installed' AS status;
