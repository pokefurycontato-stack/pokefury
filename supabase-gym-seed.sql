-- ============================================================
-- SEED: GYM REGIONS + LEADERS
-- ============================================================

DELETE FROM gym_leaders;
DELETE FROM gym_regions;

-- KANTO
INSERT INTO gym_regions (id, name, sort_order) VALUES
('a0000000-0000-0000-0000-000000000001', 'Kanto', 1);

INSERT INTO gym_leaders (region_id, name, gym_number, type, badge_name, sprite_url, dialogue, pokemon_list) VALUES
('a0000000-0000-0000-0000-000000000001', 'Brock', 1, 'Rock', 'Rock Badge',
 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/trainers/rock.png',
 'Eu sou Brock! Meus Pokemon de pedra sao resistentes!',
 '[{"pokemon_id":74,"name":"Geodude","level":12,"moves":[{"move_id":100,"name":"Tackle"},{"move_id":89,"name":"Rock Throw"}]},{"pokemon_id":95,"name":"Onix","level":14,"moves":[{"move_id":100,"name":"Tackle"},{"move_id":89,"name":"Rock Throw"}]}]'),
('a0000000-0000-0000-0000-000000000001', 'Misty', 2, 'Water', 'Cascade Badge',
 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/trainers/water.png',
 'Eu sou Misty! Minhas aquaticas sao poderosas!',
 '[{"pokemon_id":120,"name":"Staryu","level":18,"moves":[{"move_id":33,"name":"Water Gun"},{"move_id":100,"name":"Tackle"}]},{"pokemon_id":121,"name":"Starmie","level":21,"moves":[{"move_id":33,"name":"Water Gun"},{"move_id":58,"name":"Ice Beam"}]}]'),
('a0000000-0000-0000-0000-000000000001', 'Lt. Surge', 3, 'Electric', 'Thunder Badge',
 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/trainers/electric.png',
 'Eu sou Lt. Surge! Meus eletricos vao te chocar!',
 '[{"pokemon_id":26,"name":"Raichu","level":24,"moves":[{"move_id":85,"name":"Thunderbolt"},{"move_id":100,"name":"Tackle"}]}]'),
('a0000000-0000-0000-0000-000000000001', 'Erika', 4, 'Grass', 'Rainbow Badge',
 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/trainers/grass.png',
 'Eu sou Erika... minhas plantas sao perigosas.',
 '[{"pokemon_id":71,"name":"Victreebel","level":29,"moves":[{"move_id":75,"name":"Razor Leaf"},{"move_id":76,"name":"Vine Whip"}]},{"pokemon_id":114,"name":"Tangela","level":29,"moves":[{"move_id":75,"name":"Razor Leaf"},{"move_id":76,"name":"Vine Whip"}]}]'),
('a0000000-0000-0000-0000-000000000001', 'Koga', 5, 'Poison', 'Soul Badge',
 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/trainers/poison.png',
 'Eu sou Koga! Meus venenos sao silenciosos...',
 '[{"pokemon_id":89,"name":"Muk","level":37,"moves":[{"move_id":92,"name":"Poison Gas"},{"move_id":93,"name":"Poison Powder"}]},{"pokemon_id":110,"name":"Weezing","level":35,"moves":[{"move_id":124,"name":"Smog"},{"move_id":92,"name":"Poison Gas"}]}]'),
('a0000000-0000-0000-0000-000000000001', 'Sabrina', 6, 'Psychic', 'Marsh Badge',
 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/trainers/psychic.png',
 'Eu sou Sabrina... eu vejo tudo com minha mente.',
 '[{"pokemon_id":65,"name":"Alakazam","level":38,"moves":[{"move_id":94,"name":"Psybeam"},{"move_id":95,"name":"Psychic"}]}]'),
('a0000000-0000-0000-0000-000000000001', 'Blaine', 7, 'Fire', 'Volcano Badge',
 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/trainers/fire.png',
 'Eu sou Blaine! Minhas chamas sao ardentes!',
 '[{"pokemon_id":59,"name":"Arcanine","level":42,"moves":[{"move_id":44,"name":"Ember"},{"move_id":46,"name":"Flamethrower"}]}]'),
('a0000000-0000-0000-0000-000000000001', 'Giovanni', 8, 'Ground', 'Earth Badge',
 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/trainers/ground.png',
 'Eu sou Giovanni... o lider mais poderoso de Kanto!',
 '[{"pokemon_id":31,"name":"Nidoqueen","level":45,"moves":[{"move_id":34,"name":"Water Gun"},{"move_id":40,"name":"Poison Sting"}]},{"pokemon_id":112,"name":"Rhydon","level":50,"moves":[{"move_id":89,"name":"Rock Throw"},{"move_id":100,"name":"Tackle"}]}]');
