-- Fix: Allow null user_id in player_progress
-- Run in Supabase Dashboard > SQL Editor

ALTER TABLE player_progress ALTER COLUMN user_id DROP NOT NULL;

NOTIFY pgrst, 'reload schema';
