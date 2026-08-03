-- ============================================================
-- ADICIONAR COLUNA held_item_id SE NÃO EXISTIR
-- ============================================================
DO $$ BEGIN
    ALTER TABLE pokemon_team ADD COLUMN held_item_id INTEGER;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
