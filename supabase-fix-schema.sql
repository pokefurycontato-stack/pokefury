-- =============================================
-- FIX: Multi-character DB issues
-- Run in Supabase SQL Editor
-- =============================================

-- 1. Ensure character_id exists on pokemon_team
DO $$ BEGIN
    ALTER TABLE pokemon_team ADD COLUMN character_id UUID;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- 2. Ensure character_id exists on player_inventory
DO $$ BEGIN
    ALTER TABLE player_inventory ADD COLUMN character_id UUID;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- 3. Drop old PK on player_inventory (was user_id, item_id)
DO $$ BEGIN
    ALTER TABLE player_inventory DROP CONSTRAINT IF EXISTS player_inventory_pkey;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 4. Drop any existing unique constraints on player_inventory
DO $$ DECLARE
    rec RECORD;
BEGIN
    FOR rec IN SELECT conname FROM pg_constraint
            WHERE conrelid = 'player_inventory'::regclass
            AND contype IN ('u', 'p')
    LOOP
        EXECUTE 'ALTER TABLE player_inventory DROP CONSTRAINT IF EXISTS ' || rec.conname;
    END LOOP;
END $$;

-- 5. Add new PK on player_inventory (character_id, item_id)
ALTER TABLE player_inventory ADD PRIMARY KEY (character_id, item_id);

-- 6. Ensure FK on pokemon_team.character_id
DO $$ BEGIN
    ALTER TABLE pokemon_team ADD CONSTRAINT pokemon_team_character_id_fkey
        FOREIGN KEY (character_id) REFERENCES game_saves(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 7. Ensure FK on player_inventory.character_id
DO $$ BEGIN
    ALTER TABLE player_inventory ADD CONSTRAINT player_inventory_character_id_fkey
        FOREIGN KEY (character_id) REFERENCES game_saves(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 8. Recreate RLS for pokemon_team with character_id
ALTER TABLE pokemon_team ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pokemonteam_select" ON pokemon_team;
DROP POLICY IF EXISTS "pokemonteam_insert" ON pokemon_team;
DROP POLICY IF EXISTS "pokemonteam_update" ON pokemon_team;
DROP POLICY IF EXISTS "pokemonteam_delete" ON pokemon_team;

CREATE POLICY "pokemonteam_select" ON pokemon_team
    FOR SELECT USING (
        auth.uid() = user_id OR
        character_id IN (SELECT id FROM game_saves WHERE user_id = auth.uid())
    );
CREATE POLICY "pokemonteam_insert" ON pokemon_team
    FOR INSERT WITH CHECK (
        auth.uid() = user_id OR
        character_id IN (SELECT id FROM game_saves WHERE user_id = auth.uid())
    );
CREATE POLICY "pokemonteam_update" ON pokemon_team
    FOR UPDATE USING (
        auth.uid() = user_id OR
        character_id IN (SELECT id FROM game_saves WHERE user_id = auth.uid())
    );
CREATE POLICY "pokemonteam_delete" ON pokemon_team
    FOR DELETE USING (
        auth.uid() = user_id OR
        character_id IN (SELECT id FROM game_saves WHERE user_id = auth.uid())
    );

-- 9. Recreate RLS for player_inventory with character_id
ALTER TABLE player_inventory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "inventory_select" ON player_inventory;
DROP POLICY IF EXISTS "inventory_insert" ON player_inventory;
DROP POLICY IF EXISTS "inventory_update" ON player_inventory;
DROP POLICY IF EXISTS "inventory_delete" ON player_inventory;

CREATE POLICY "inventory_select" ON player_inventory
    FOR SELECT USING (
        auth.uid() = user_id OR
        character_id IN (SELECT id FROM game_saves WHERE user_id = auth.uid())
    );
CREATE POLICY "inventory_insert" ON player_inventory
    FOR INSERT WITH CHECK (
        auth.uid() = user_id OR
        character_id IN (SELECT id FROM game_saves WHERE user_id = auth.uid())
    );
CREATE POLICY "inventory_update" ON player_inventory
    FOR UPDATE USING (
        auth.uid() = user_id OR
        character_id IN (SELECT id FROM game_saves WHERE user_id = auth.uid())
    );
CREATE POLICY "inventory_delete" ON player_inventory
    FOR DELETE USING (
        auth.uid() = user_id OR
        character_id IN (SELECT id FROM game_saves WHERE user_id = auth.uid())
    );
