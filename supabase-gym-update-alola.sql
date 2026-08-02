-- ALOLA (Kahunas)
UPDATE gym_leaders SET type='Fighting', badge_name='Melemele Grand Trial',
sprite_url='https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/trainers/fighting.png',
dialogue='Eu sou Hala! Luta e honra!',
pokemon_list='[{"pokemon_id":62,"name":"Poliwrath","level":15,"moves":[{"move_id":55,"name":"Bubble Beam"},{"move_id":99,"name":"Low Kick"}]},{"pokemon_id":68,"name":"Machamp","level":15,"moves":[{"move_id":68,"name":"Karate Chop"},{"move_id":99,"name":"Low Kick"}]}]'
WHERE name='Hala';

UPDATE gym_leaders SET type='Rock', badge_name='Akala Grand Trial',
sprite_url='https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/trainers/rock.png',
dialogue='Eu sou Olivia! Pedras sao preciosas!',
pokemon_list='[{"pokemon_id":74,"name":"Geodude","level":25,"moves":[{"move_id":89,"name":"Rock Throw"},{"move_id":100,"name":"Tackle"}]},{"pokemon_id":138,"name":"Omanyte","level":25,"moves":[{"move_id":33,"name":"Water Gun"},{"move_id":89,"name":"Rock Throw"}]}]'
WHERE name='Olivia';

UPDATE gym_leaders SET type='Ghost', badge_name='Ula''ula Grand Trial',
sprite_url='https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/trainers/ghost.png',
dialogue='Eu sou Nanu! Fantasmas sao misteriosos!',
pokemon_list='[{"pokemon_id":94,"name":"Gengar","level":35,"moves":[{"move_id":93,"name":"Poison Gas"},{"move_id":109,"name":"Confuse Ray"}]},{"pokemon_id":53,"name":"Persian","level":35,"moves":[{"move_id":100,"name":"Tackle"},{"move_id":109,"name":"Confuse Ray"}]}]'
WHERE name='Nanu';

UPDATE gym_leaders SET type='Ground', badge_name='Poni Grand Trial',
sprite_url='https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/trainers/ground.png',
dialogue='Eu sou Hapu! Terra e vida!',
pokemon_list='[{"pokemon_id":750,"name":"Mudsdale","level":45,"moves":[{"move_id":106,"name":"Rock Slide"},{"move_id":39,"name":"Take Down"}]},{"pokemon_id":423,"name":"Gastrodon","level":45,"moves":[{"move_id":33,"name":"Water Gun"},{"move_id":89,"name":"Rock Throw"}]}]'
WHERE name='Hapu';
