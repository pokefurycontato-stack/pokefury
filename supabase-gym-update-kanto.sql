-- ============================================================
-- UPDATE: PREENCHER DADOS DOS LÍDERES
-- Execute este SQL para adicionar tipo, insígnia, sprite, diálogo e pokémon
-- ============================================================

-- KANTO
UPDATE gym_leaders SET type='Rock', badge_name='Rock Badge',
sprite_url='https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/trainers/rock.png',
dialogue='Eu sou Brock! Meus Pokemon de pedra sao resistentes!',
pokemon_list='[{"pokemon_id":74,"name":"Geodude","level":12,"moves":[{"move_id":100,"name":"Tackle"},{"move_id":89,"name":"Rock Throw"}]},{"pokemon_id":95,"name":"Onix","level":14,"moves":[{"move_id":100,"name":"Tackle"},{"move_id":89,"name":"Rock Throw"}]}]'
WHERE name='Brock';

UPDATE gym_leaders SET type='Water', badge_name='Cascade Badge',
sprite_url='https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/trainers/water.png',
dialogue='Eu sou Misty! Minhas aquaticas sao poderosas!',
pokemon_list='[{"pokemon_id":120,"name":"Staryu","level":18,"moves":[{"move_id":33,"name":"Water Gun"},{"move_id":100,"name":"Tackle"}]},{"pokemon_id":121,"name":"Starmie","level":21,"moves":[{"move_id":33,"name":"Water Gun"},{"move_id":58,"name":"Ice Beam"}]}]'
WHERE name='Misty';

UPDATE gym_leaders SET type='Electric', badge_name='Thunder Badge',
sprite_url='https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/trainers/electric.png',
dialogue='Eu sou Lt. Surge! Meus eletricos vao te chocar!',
pokemon_list='[{"pokemon_id":26,"name":"Raichu","level":24,"moves":[{"move_id":85,"name":"Thunderbolt"},{"move_id":100,"name":"Tackle"}]}]'
WHERE name='Lt. Surge';

UPDATE gym_leaders SET type='Grass', badge_name='Rainbow Badge',
sprite_url='https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/trainers/grass.png',
dialogue='Eu sou Erika... minhas plantas sao perigosas.',
pokemon_list='[{"pokemon_id":71,"name":"Victreebel","level":29,"moves":[{"move_id":75,"name":"Razor Leaf"},{"move_id":76,"name":"Vine Whip"}]},{"pokemon_id":114,"name":"Tangela","level":29,"moves":[{"move_id":75,"name":"Razor Leaf"},{"move_id":76,"name":"Vine Whip"}]}]'
WHERE name='Erika';

UPDATE gym_leaders SET type='Poison', badge_name='Soul Badge',
sprite_url='https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/trainers/poison.png',
dialogue='Eu sou Koga! Meus venenos sao silenciosos...',
pokemon_list='[{"pokemon_id":89,"name":"Muk","level":37,"moves":[{"move_id":92,"name":"Poison Gas"},{"move_id":93,"name":"Poison Powder"}]},{"pokemon_id":110,"name":"Weezing","level":35,"moves":[{"move_id":124,"name":"Smog"},{"move_id":92,"name":"Poison Gas"}]}]'
WHERE name='Koga';

UPDATE gym_leaders SET type='Psychic', badge_name='Marsh Badge',
sprite_url='https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/trainers/psychic.png',
dialogue='Eu sou Sabrina... eu vejo tudo com minha mente.',
pokemon_list='[{"pokemon_id":65,"name":"Alakazam","level":38,"moves":[{"move_id":94,"name":"Psybeam"},{"move_id":95,"name":"Psychic"}]}]'
WHERE name='Sabrina';

UPDATE gym_leaders SET type='Fire', badge_name='Volcano Badge',
sprite_url='https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/trainers/fire.png',
dialogue='Eu sou Blaine! Minhas chamas sao ardentes!',
pokemon_list='[{"pokemon_id":59,"name":"Arcanine","level":42,"moves":[{"move_id":44,"name":"Ember"},{"move_id":46,"name":"Flamethrower"}]}]'
WHERE name='Blaine';

UPDATE gym_leaders SET type='Ground', badge_name='Earth Badge',
sprite_url='https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/trainers/ground.png',
dialogue='Eu sou Giovanni... o lider mais poderoso de Kanto!',
pokemon_list='[{"pokemon_id":31,"name":"Nidoqueen","level":45,"moves":[{"move_id":34,"name":"Water Gun"},{"move_id":40,"name":"Poison Sting"}]},{"pokemon_id":112,"name":"Rhydon","level":50,"moves":[{"move_id":89,"name":"Rock Throw"},{"move_id":100,"name":"Tackle"}]}]'
WHERE name='Giovanni';
