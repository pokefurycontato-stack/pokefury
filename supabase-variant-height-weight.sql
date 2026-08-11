-- Update height/weight for ALL variant Pokemon based on their base form
-- Mega, Gmax, Alola, Galar, Hisui, Paldea, Special Forms

UPDATE pokemon v
SET height = b.height, weight = b.weight
FROM pokemon b
WHERE v.base_pokemon_id = b.id
  AND v.base_pokemon_id IS NOT NULL
  AND (v.height IS NULL OR v.height = 10);

-- Manually set known variant heights that differ from base form
-- (most variants keep the same height as base)

-- Alola Exeggutor is much taller (10.9m vs 2.0m)
UPDATE pokemon SET height = 109, weight = 415 WHERE id = 12011;

-- Galar Corsola is different
UPDATE pokemon SET height = 6, weight = 5 WHERE id = 12019;

-- Zygarde Complete is much bigger (4.5m vs 1.2m for 10%)
UPDATE pokemon SET height = 45, weight = 6100 WHERE id = 13012;

-- Eternatus Eternamax is massive (100m)
UPDATE pokemon SET height = 1000, weight = 0 WHERE id = 13003;

-- Wishiwashi School is bigger
UPDATE pokemon SET height = 12, weight = 786 WHERE id = 13028;

-- Palafin Hero is bigger
UPDATE pokemon SET height = 18, weight = 210 WHERE id = 13053;

-- Hoopa Unbound is bigger (6.5m vs 0.3m)
UPDATE pokemon SET height = 65, weight = 490 WHERE id = 13048;

-- Gmax forms are typically much bigger
UPDATE pokemon SET height = 280, weight = 1000 WHERE id = 11001;  -- Charizard Gmax
UPDATE pokemon SET height = 140, weight = 408 WHERE id = 11002;   -- Butterfree Gmax
UPDATE pokemon SET height = 210, weight = 1310 WHERE id = 11003;  -- Pikachu Gmax
UPDATE pokemon SET height = 330, weight = 450 WHERE id = 11005;   -- Machamp Gmax
UPDATE pokemon SET height = 200, weight = 4500 WHERE id = 11006;  -- Gengar Gmax
UPDATE pokemon SET height = 240, weight = 1100 WHERE id = 11007;  -- Kingler Gmax
UPDATE pokemon SET height = 240, weight = 2250 WHERE id = 11008;  -- Lapras Gmax
UPDATE pokemon SET height = 210, weight = 2450 WHERE id = 11010;  -- Snorlax Gmax
UPDATE pokemon SET height = 300, weight = 1305 WHERE id = 11011;  -- Garbodor Gmax
UPDATE pokemon SET height = 250, weight = 9000 WHERE id = 11012;  -- Melmetal Gmax
UPDATE pokemon SET height = 140, weight = 400 WHERE id = 11013;   -- Corviknight Gmax
UPDATE pokemon SET height = 140, weight = 408 WHERE id = 11014;   -- Orbeetle Gmax
UPDATE pokemon SET height = 250, weight = 2100 WHERE id = 11015;  -- Drednaw Gmax
UPDATE pokemon SET height = 420, weight = 8500 WHERE id = 11016;  -- Coalossal Gmax
UPDATE pokemon SET height = 240, weight = 400 WHERE id = 11017;   -- Flapple Gmax
UPDATE pokemon SET height = 240, weight = 400 WHERE id = 11018;   -- Appletun Gmax
UPDATE pokemon SET height = 430, weight = 1200 WHERE id = 11021;  -- Centiskorch Gmax
UPDATE pokemon SET height = 260, weight = 740 WHERE id = 11022;   -- Hatterene Gmax
UPDATE pokemon SET height = 320, weight = 600 WHERE id = 11023;   -- Grimmsnarl Gmax
UPDATE pokemon SET height = 300, weight = 2100 WHERE id = 11025;  -- Copperajah Gmax
UPDATE pokemon SET height = 450, weight = 2100 WHERE id = 11026;  -- Duraludon Gmax

-- Gmax Venusaur/Blaze/Shell
UPDATE pokemon SET height = 240, weight = 1000 WHERE id = 13068;  -- Venusaur Gmax
UPDATE pokemon SET height = 250, weight = 2121 WHERE id = 13069;  -- Blastoise Gmax

-- Special forms with different heights
UPDATE pokemon SET height = 70, weight = 330 WHERE id = 13016;    -- Giratina Origin (9.3m→70)
UPDATE pokemon SET height = 40, weight = 52 WHERE id = 13017;     -- Shaymin Sky
UPDATE pokemon SET height = 58, weight = 650 WHERE id = 13008;    -- Necrozma Dusk Mane
UPDATE pokemon SET height = 42, weight = 500 WHERE id = 13009;    -- Necrozma Dawn Wings
UPDATE pokemon SET height = 75, weight = 2300 WHERE id = 13010;   -- Necrozma Ultra
UPDATE pokemon SET height = 50, weight = 3050 WHERE id = 13059;   -- Palkia Origin
UPDATE pokemon SET height = 52, weight = 6830 WHERE id = 13060;   -- Dialga Origin
