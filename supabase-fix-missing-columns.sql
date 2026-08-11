-- FIX: Add missing columns to pokemon_team
-- Run in Supabase SQL Editor

DO $$ BEGIN
    ALTER TABLE pokemon_team ADD COLUMN is_shiny BOOLEAN DEFAULT false;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE pokemon_team ADD COLUMN is_mega BOOLEAN DEFAULT false;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE pokemon_team ADD COLUMN held_item_id INTEGER;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Cleanup: delete duplicate characters (keep only the newest one per starter)
DELETE FROM game_saves
WHERE id NOT IN (
    SELECT DISTINCT ON (starter_pokemon) id
    FROM game_saves
    WHERE user_id = 'b405808e-2fc3-4fa9-8b31-ebe7883223bf'
    ORDER BY starter_pokemon, created_at DESC
)
AND user_id = 'b405808e-2fc3-4fa9-8b31-ebe7883223bf';
