-- ============================================================
-- FIX GAME_SAVES - Remove unique constraint em user_id
-- Permite múltiplos personagens por conta
-- ============================================================

-- Remover UNIQUE constraints (não o primary key!)
DO $$ DECLARE
    rec RECORD;
BEGIN
    FOR rec IN SELECT conname FROM pg_constraint
               WHERE conrelid = 'game_saves'::regclass
               AND contype = 'u'
    LOOP
        EXECUTE 'ALTER TABLE game_saves DROP CONSTRAINT IF EXISTS ' || rec.conname;
        RAISE NOTICE 'Dropped unique constraint: %', rec.conname;
    END LOOP;
END $$;

-- Garantir índice normal (não unique) em user_id
DROP INDEX IF EXISTS idx_game_saves_user_id;
CREATE INDEX IF NOT EXISTS idx_game_saves_user_id ON game_saves(user_id);
