-- Add rarity column to map_encounters
ALTER TABLE map_encounters ADD COLUMN IF NOT EXISTS rarity TEXT DEFAULT 'common';

-- Update existing encounters with rarity based on pokemon base stat total
-- Common: BST < 400 (basic pokemon)
-- Uncommon: BST 400-499 (mid-evolutions)
-- Rare: BST 500-599 (fully evolved)
-- Legendary: BST >= 600 (legendaries/pseudo-legendaries)
UPDATE map_encounters me
SET rarity = CASE
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
