-- Add rarity column to map_encounters
ALTER TABLE map_encounters ADD COLUMN IF NOT EXISTS rarity TEXT DEFAULT 'common';

-- Update existing encounters with rarity based on pokemon base stat total
-- Common: BST < 400 (basic pokemon)
-- Uncommon: BST 400-499 (mid-evolutions)
-- Rare: BST 500-599 (fully evolved)
-- Legendary: BST >= 600 (legendaries/pseudo-legendaries)
--Inicial: starter Pokemon and their evolutions (special tier)
UPDATE map_encounters me
SET rarity = CASE
    WHEN p.id IN (144,145,146,150,151,
                   243,244,245,249,250,251,
                   377,378,379,380,381,382,383,384,385,386,
                   480,481,482,483,484,485,486,488,490,491,492,493,
                   638,639,640,641,642,643,644,645,646,647,648,649,
                   716,717,718,719,720,721,
                   785,786,787,788,789,790,791,792,793,794,795,796,797,798,799,800,801,802,807,808,809,
                   891,892,893,894,895,896,897,898,905,
                   1000,1001,1002,1003,1007,1008,1009,1010,1024) THEN 'legendary'
    WHEN p.id IN (1,2,3,4,5,6,7,8,9,152,153,154,155,156,157,158,159,160,
                   252,253,254,255,256,257,258,259,260,387,388,389,390,391,392,393,394,395,
                   495,496,497,498,499,500,501,502,503,650,651,652,653,654,655,656,657,658,
                   722,723,724,725,726,727,728,729,730,810,811,812,813,814,815,816,817,818,
                   906,907,908,909,910,911,912,913,914) THEN 'inicial'
    WHEN (p.hp + p.attack + p.defense + p.sp_atk + p.sp_def + p.speed) >= 600 THEN 'legendary'
    WHEN (p.hp + p.attack + p.defense + p.sp_atk + p.sp_def + p.speed) >= 500 THEN 'rare'
    WHEN (p.hp + p.attack + p.defense + p.sp_atk + p.sp_def + p.speed) >= 400 THEN 'uncommon'
    ELSE 'common'
END
FROM pokemon p
WHERE me.pokemon_id = p.id;

-- Update weights per rarity tier
UPDATE map_encounters SET weight = 50 WHERE rarity = 'common';
UPDATE map_encounters SET weight = 30 WHERE rarity = 'uncommon';
UPDATE map_encounters SET weight = 15 WHERE rarity = 'rare';
UPDATE map_encounters SET weight = 5  WHERE rarity = 'legendary';
UPDATE map_encounters SET weight = 5  WHERE rarity = 'inicial';
