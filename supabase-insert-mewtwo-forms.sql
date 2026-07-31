-- Mewtwo Special Forms (fan-made)
-- Run in Supabase Dashboard > SQL Editor

INSERT INTO pokemon (id, name, types, hp, attack, defense, sp_atk, sp_def, speed, variant, base_pokemon_id)
VALUES
(13064, 'Mewtwo (Armour)', '{psychic}', 111, 110, 90, 200, 135, 135, 'form', 150),
(13065, 'Mewtwo (Synergy)', '{psychic}', 111, 110, 90, 200, 135, 135, 'form', 150)
ON CONFLICT (id) DO NOTHING;

NOTIFY pgrst, 'reload schema';
