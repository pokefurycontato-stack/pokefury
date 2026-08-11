-- ============================================================
-- CLEANUP: Remove entries from pokemon_moves_v2 where move_id
-- is actually an ability ID (not a real move)
-- Run this ONCE in Supabase SQL Editor
-- ============================================================

-- Remove moves from pokemon_moves_v2 that don't exist in the moves table
-- These are likely ability IDs that got mixed in
DELETE FROM pokemon_moves_v2
WHERE move_id NOT IN (SELECT id FROM moves);

-- Also verify Ember (move_id=10) exists for Charmander (pokemon_id=4)
-- If not, we need to insert it manually
INSERT INTO moves (id, name, type, category, power, accuracy, pp)
SELECT 10, 'Ember', 'fire', 'special', 40, 100, 25
WHERE NOT EXISTS (SELECT 1 FROM moves WHERE id = 10);

-- Verify Charmander has Ember in pokemon_moves_v2 at level 6
INSERT INTO pokemon_moves_v2 (pokemon_id, move_id, learn_method, level_learned)
SELECT 4, 10, 'level-up', 6
WHERE NOT EXISTS (
    SELECT 1 FROM pokemon_moves_v2
    WHERE pokemon_id = 4 AND move_id = 10 AND learn_method = 'level-up'
);
