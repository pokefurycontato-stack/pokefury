-- Remove duplicate evolution entries (keep first of each from+to pair)
DELETE FROM pokemon_evolutions a
USING pokemon_evolutions b
WHERE a.id > b.id
  AND a.from_pokemon_id = b.from_pokemon_id
  AND a.to_pokemon_id = b.to_pokemon_id;

SELECT count(*) AS remaining FROM pokemon_evolutions;
