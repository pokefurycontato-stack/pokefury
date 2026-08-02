-- ============================================================
-- FIX GAME_SAVES - Remove unique constraint em user_id
-- Permite múltiplos personagens por conta
-- ============================================================

-- Remover UNIQUE constraint em user_id se existir
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

-- Remover índices únicos em user_id
DO $$ DECLARE
    idx RECORD;
BEGIN
    FOR idx IN SELECT indexname FROM pg_indexes
               WHERE tablename = 'game_saves'
               AND indexdef LIKE '%UNIQUE%'
    LOOP
        EXECUTE 'DROP INDEX IF EXISTS ' || idx.indexname;
        RAISE NOTICE 'Dropped unique index: %', idx.indexname;
    END LOOP;
END $$;

-- Garantir que user_id NÃO tem unique constraint
-- (permite múltiplos personagens por conta)
CREATE INDEX IF NOT EXISTS idx_game_saves_user_id ON game_saves(user_id);
