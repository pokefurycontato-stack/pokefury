-- Run this in Supabase Dashboard > SQL Editor

-- Fix: allow authenticated users (admin) to insert evolutions
DROP POLICY IF EXISTS "evo_insert" ON pokemon_evolutions;
CREATE POLICY "evo_insert" ON pokemon_evolutions FOR INSERT WITH CHECK (true);
