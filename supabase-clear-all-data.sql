-- Clear all characters and pokemon to start fresh
-- Run in Supabase Dashboard > SQL Editor

-- Delete pokemon in teams first (foreign key dependency)
DELETE FROM pokemon_team;

-- Delete pokemon in PC
DELETE FROM pokemon_pc;

-- Delete player progress
DELETE FROM player_progress;

-- Delete game saves (characters)
DELETE FROM game_saves;

-- Delete map pokemon entities
DELETE FROM map_pokemon_entities;

-- Reset auto-increment if exists
-- ALTER SEQUENCE game_saves_id_seq RESTART WITH 1;

NOTIFY pgrst, 'reload schema';
