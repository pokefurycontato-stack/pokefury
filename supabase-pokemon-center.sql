-- ============================================================
-- POKEMON CENTER: Add a Pokemon Center map to every region
-- Run this ONCE in Supabase SQL Editor
-- ============================================================

-- Add Pokemon Center as the last map (sort_order 9) in every region
-- No encounters, no battles - safe zone
WITH regions AS (
    SELECT id FROM regions
)
INSERT INTO region_maps (region_id, name, image_url, sort_order, encounter_rate, min_level, max_level, battle_bg_url)
SELECT
    r.id,
    'Centro Pokemon',
    '',
    9,
    0,
    0,
    0,
    ''
FROM regions r
WHERE NOT EXISTS (
    SELECT 1 FROM region_maps rm
    WHERE rm.region_id = r.id AND rm.name = 'Centro Pokemon'
);
