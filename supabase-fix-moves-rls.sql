-- Fix RLS policies for moves table
-- Run in Supabase Dashboard > SQL Editor

-- Drop existing policies
DO $$ BEGIN
    DROP POLICY IF EXISTS "moves_select" ON moves;
    DROP POLICY IF EXISTS "moves_insert" ON moves;
    DROP POLICY IF EXISTS "moves_update" ON moves;
    DROP POLICY IF EXISTS "moves_delete" ON moves;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Recreate permissive policies
CREATE POLICY "moves_select" ON moves FOR SELECT USING (true);
CREATE POLICY "moves_insert" ON moves FOR INSERT WITH CHECK (true);
CREATE POLICY "moves_update" ON moves FOR UPDATE USING (true);
CREATE POLICY "moves_delete" ON moves FOR DELETE USING (true);

-- Also fix pokemon_moves_v2 if needed
DO $$ BEGIN
    DROP POLICY IF EXISTS "pmv2_select" ON pokemon_moves_v2;
    DROP POLICY IF EXISTS "pmv2_insert" ON pokemon_moves_v2;
    DROP POLICY IF EXISTS "pmv2_update" ON pokemon_moves_v2;
    DROP POLICY IF EXISTS "pmv2_delete" ON pokemon_moves_v2;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "pmv2_select" ON pokemon_moves_v2 FOR SELECT USING (true);
CREATE POLICY "pmv2_insert" ON pokemon_moves_v2 FOR INSERT WITH CHECK (true);
CREATE POLICY "pmv2_update" ON pokemon_moves_v2 FOR UPDATE USING (true);
CREATE POLICY "pmv2_delete" ON pokemon_moves_v2 FOR DELETE USING (true);

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
