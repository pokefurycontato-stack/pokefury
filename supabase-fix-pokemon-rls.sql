-- Run this in Supabase Dashboard > SQL Editor
-- Allow authenticated users to insert/update pokemon (for admin variant seeding)

DROP POLICY IF EXISTS "pokemon_insert" ON pokemon;
CREATE POLICY "pokemon_insert" ON pokemon FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "pokemon_update" ON pokemon;
CREATE POLICY "pokemon_update" ON pokemon FOR UPDATE USING (true);
