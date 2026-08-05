-- ============================================================
-- FIX: Remove FK constraint de game_saves para profiles
-- O profiles pode não existir quando cria personagem
-- ============================================================

DO $$ BEGIN
    ALTER TABLE game_saves DROP CONSTRAINT IF EXISTS game_saves_user_id_fkey;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
