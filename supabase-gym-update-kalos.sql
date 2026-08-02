-- KALOS
UPDATE gym_leaders SET type='Bug', badge_name='Bug Badge',
sprite_url='https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/trainers/bug.png',
dialogue='Eu sou Viola! Insetos sao delicados!',
pokemon_list='[{"pokemon_id":267,"name":"Butterfree","level":10,"moves":[{"move_id":122,"name":"Bug Buzz"},{"move_id":17,"name":"Wing Attack"}]},{"pokemon_id":282,"name":"Gardevoir","level":12,"moves":[{"move_id":95,"name":"Psychic"},{"move_id":100,"name":"Tackle"}]}]'
WHERE name='Viola';

UPDATE gym_leaders SET type='Rock', badge_name='Cliff Badge',
sprite_url='https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/trainers/rock.png',
dialogue='Eu sou Grant! Rochas sao fortes!',
pokemon_list='[{"pokemon_id":557,"name":"Dwebble","level":25,"moves":[{"move_id":89,"name":"Rock Throw"},{"move_id":122,"name":"Bug Buzz"}]},{"pokemon_id":697,"name":"Tyrunt","level":25,"moves":[{"move_id":43,"name":"Dragon Rage"},{"move_id":89,"name":"Rock Throw"}]}]'
WHERE name='Grant';

UPDATE gym_leaders SET type='Fighting', badge_name='Rumble Badge',
sprite_url='https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/trainers/fighting.png',
dialogue='Eu sou Korrina! Luta e velocidade!',
pokemon_list='[{"pokemon_id":68,"name":"Machamp","level":28,"moves":[{"move_id":68,"name":"Karate Chop"},{"move_id":99,"name":"Low Kick"}]},{"pokemon_id":702,"name":"Dedenne","level":28,"moves":[{"move_id":85,"name":"Thunderbolt"},{"move_id":100,"name":"Tackle"}]}]'
WHERE name='Korrina';

UPDATE gym_leaders SET type='Grass', badge_name='Plant Badge',
sprite_url='https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/trainers/grass.png',
dialogue='Eu sou Ramos! Plantas sao vivas!',
pokemon_list='[{"pokemon_id":455,"name":"Carnivine","level":30,"moves":[{"move_id":75,"name":"Razor Leaf"},{"move_id":76,"name":"Vine Whip"}]},{"pokemon_id":673,"name":"Gogoat","level":32,"moves":[{"move_id":75,"name":"Razor Leaf"},{"move_id":39,"name":"Take Down"}]}]'
WHERE name='Ramos';

UPDATE gym_leaders SET type='Fairy', badge_name='Fairy Badge',
sprite_url='https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/trainers/fairy.png',
dialogue='Eu sou Valerie! Fadas sao magicas!',
pokemon_list='[{"pokemon_id":700,"name":"Sylveon","level":32,"moves":[{"move_id":101,"name":"Lick"},{"move_id":109,"name":"Confuse Ray"}]},{"pokemon_id":186,"name":"Politoed","level":32,"moves":[{"move_id":33,"name":"Water Gun"},{"move_id":100,"name":"Tackle"}]}]'
WHERE name='Valerie';

UPDATE gym_leaders SET type='Psychic', badge_name='Psychic Badge',
sprite_url='https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/trainers/psychic.png',
dialogue='Eu sou Olympia! Mentes se conectam!',
pokemon_list='[{"pokemon_id":196,"name":"Espeon","level":36,"moves":[{"move_id":95,"name":"Psychic"},{"move_id":100,"name":"Tackle"}]},{"pokemon_id":605,"name":"Elgyem","level":36,"moves":[{"move_id":95,"name":"Psychic"},{"move_id":109,"name":"Confuse Ray"}]}]'
WHERE name='Olympia';

UPDATE gym_leaders SET type='Ice', badge_name='Iceberg Badge',
sprite_url='https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/trainers/ice.png',
dialogue='Eu sou Wulfric! Gelo e puro!',
pokemon_list='[{"pokemon_id":473,"name":"Mamoswine","level":40,"moves":[{"move_id":58,"name":"Ice Beam"},{"move_id":89,"name":"Rock Throw"}]},{"pokemon_id":713,"name":"Avalugg","level":40,"moves":[{"move_id":58,"name":"Ice Beam"},{"move_id":100,"name":"Tackle"}]}]'
WHERE name='Wulfric';
