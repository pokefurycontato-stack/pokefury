-- ============================================================
-- BIOME SEED: 8 maps per region, encounters by type + generation
-- Run this ONCE in Supabase SQL Editor
-- ============================================================

-- 1) Ensure all 9 regions exist (idempotent)
INSERT INTO regions (name, description, sort_order)
SELECT name, description, sort_order
FROM (VALUES
    ('Kanto',  'Generation 1 - Kanto', 1),
    ('Johto',  'Generation 2 - Johto', 2),
    ('Hoenn',  'Generation 3 - Hoenn', 3),
    ('Sinnoh', 'Generation 4 - Sinnoh', 4),
    ('Unova',  'Generation 5 - Unova', 5),
    ('Kalos',  'Generation 6 - Kalos', 6),
    ('Alola',  'Generation 7 - Alola', 7),
    ('Galar',  'Generation 8 - Galar', 8),
    ('Paldea', 'Generation 9 - Paldea', 9)
) AS v(name, description, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM regions r WHERE r.name = v.name);

-- 2) Create biome maps for each region (skip if already exists by name+region)
WITH regions AS (
    SELECT id, name, sort_order FROM regions
),
biomes(name, sort_offset, battle_bg) AS (VALUES
    ('Floresta',    1, 'grama.png'),
    ('Montanha',    2, 'pedra.png'),
    ('Torre',       3, 'pedra.png'),
    ('Industrial',  4, 'pedra.png'),
    ('Penhasco',    5, 'pedra.png'),
    ('Praia',       6, 'agua.png'),
    ('Vulcao',      7, 'pedra.png'),
    ('Geleira',     8, 'agua.png')
)
INSERT INTO region_maps (region_id, name, image_url, sort_order, encounter_rate, min_level, max_level, battle_bg_url)
SELECT
    r.id,
    b.name,
    'https://odevwnnpzsoltbrrjdts.supabase.co/storage/v1/object/public/sprites/battle_backgrounds/' || b.battle_bg,
    b.sort_offset,
    15,
    CASE b.name
        WHEN 'Floresta'   THEN 3
        WHEN 'Montanha'   THEN 5
        WHEN 'Torre'      THEN 7
        WHEN 'Industrial' THEN 5
        WHEN 'Penhasco'   THEN 7
        WHEN 'Praia'      THEN 3
        WHEN 'Vulcao'     THEN 8
        WHEN 'Geleira'    THEN 6
    END,
    CASE b.name
        WHEN 'Floresta'   THEN 15
        WHEN 'Montanha'   THEN 20
        WHEN 'Torre'      THEN 25
        WHEN 'Industrial' THEN 20
        WHEN 'Penhasco'   THEN 25
        WHEN 'Praia'      THEN 15
        WHEN 'Vulcao'     THEN 30
        WHEN 'Geleira'    THEN 25
    END,
    'https://odevwnnpzsoltbrrjdts.supabase.co/storage/v1/object/public/sprites/battle_backgrounds/' || b.battle_bg
FROM regions r
CROSS JOIN biomes b
WHERE NOT EXISTS (
    SELECT 1 FROM region_maps rm
    WHERE rm.region_id = r.id AND rm.name = b.name
);

-- 3) Insert encounters per biome per region
-- Uses pokemon types to match biomes, and pokemon ID ranges for generation filtering
WITH regions AS (
    SELECT id, name, sort_order FROM regions
),
biome_types(biome_name, type) AS (VALUES
    ('Floresta', 'grass'),
    ('Floresta', 'bug'),
    ('Floresta', 'poison'),
    ('Floresta', 'normal'),
    ('Montanha', 'ground'),
    ('Montanha', 'rock'),
    ('Montanha', 'fighting'),
    ('Torre',    'ghost'),
    ('Torre',    'psychic'),
    ('Torre',    'dark'),
    ('Torre',    'fairy'),
    ('Industrial', 'steel'),
    ('Industrial', 'electric'),
    ('Penhasco', 'dragon'),
    ('Penhasco', 'flying'),
    ('Praia',    'water'),
    ('Vulcao',   'fire'),
    ('Geleira',  'ice')
),
biome_levels(biome_name, min_level, max_level) AS (VALUES
    ('Floresta',    3, 15),
    ('Montanha',    5, 20),
    ('Torre',       7, 25),
    ('Industrial',  5, 20),
    ('Penhasco',    7, 25),
    ('Praia',       3, 15),
    ('Vulcao',      8, 30),
    ('Geleira',     6, 25)
),
-- Build type filter per biome as text arrays
biome_type_arrays(biome_name, types_arr) AS (
    SELECT biome_name, array_agg(type ORDER BY type)
    FROM biome_types
    GROUP BY biome_name
),
-- Cross join regions with biome type arrays to get (region_id, region_name, biome_name, types_arr)
region_biomes AS (
    SELECT r.id AS region_id, r.name AS region_name, bta.biome_name, bta.types_arr
    FROM regions r
    CROSS JOIN biome_type_arrays bta
),
-- Get the map ID for each region+biome combination
region_biome_maps AS (
    SELECT rb.region_id, rb.region_name, rb.biome_name, rb.types_arr, rm.id AS map_id
    FROM region_biomes rb
    JOIN region_maps rm ON rm.region_id = rb.region_id AND rm.name = rb.biome_name
)
-- Insert encounters: pokemon that have at least one matching type for the biome
INSERT INTO map_encounters (map_id, pokemon_name, pokemon_id, weight, min_level, max_level, sprite_url)
SELECT
    rbm.map_id,
    p.name,
    p.id,
    50,
    bl.min_level,
    bl.max_level,
    'https://odevwnnpzsoltbrrjdts.supabase.co/storage/v1/object/public/sprites/animated-front/' || p.id || '.gif'
FROM region_biome_maps rbm
JOIN pokemon p ON p.types && rbm.types_arr
JOIN biome_levels bl ON bl.biome_name = rbm.biome_name
JOIN regions r ON r.id = rbm.region_id
WHERE p.variant = 'normal'
  AND (
    -- Gen 1: 1-151
    (r.sort_order = 1 AND p.id BETWEEN 1 AND 151)
    -- Gen 2: 152-251
    OR (r.sort_order = 2 AND p.id BETWEEN 152 AND 251)
    -- Gen 3: 252-386
    OR (r.sort_order = 3 AND p.id BETWEEN 252 AND 386)
    -- Gen 4: 387-493
    OR (r.sort_order = 4 AND p.id BETWEEN 387 AND 493)
    -- Gen 5: 494-649
    OR (r.sort_order = 5 AND p.id BETWEEN 494 AND 649)
    -- Gen 6: 650-721
    OR (r.sort_order = 6 AND p.id BETWEEN 650 AND 721)
    -- Gen 7: 722-809
    OR (r.sort_order = 7 AND p.id BETWEEN 722 AND 809)
    -- Gen 8: 810-905
    OR (r.sort_order = 8 AND p.id BETWEEN 810 AND 905)
    -- Gen 9: 906-1025
    OR (r.sort_order = 9 AND p.id BETWEEN 906 AND 1025)
  )
  AND NOT EXISTS (
    SELECT 1 FROM map_encounters me
    WHERE me.map_id = rbm.map_id AND me.pokemon_id = p.id
  );
