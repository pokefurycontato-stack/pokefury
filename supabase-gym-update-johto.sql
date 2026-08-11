-- JOHTO
UPDATE gym_leaders SET type='Flying', badge_name='Zephyr Badge',
sprite_url='https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/trainers/flying.png',
dialogue='Eu sou Falkner! Meus passaros dominam os ceus!',
pokemon_list='[{"pokemon_id":17,"name":"Pidgeotto","level":13,"moves":[{"move_id":17,"name":"Wing Attack"},{"move_id":100,"name":"Tackle"}]}]'
WHERE name='Falkner';

UPDATE gym_leaders SET type='Bug', badge_name='Hive Badge',
sprite_url='https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/trainers/bug.png',
dialogue='Eu sou Bugsy! Meus insetos sao ageis!',
pokemon_list='[{"pokemon_id":14,"name":"Metapod","level":15,"moves":[{"move_id":100,"name":"Tackle"}]},{"pokemon_id":15,"name":"Beedrill","level":15,"moves":[{"move_id":40,"name":"Poison Sting"},{"move_id":100,"name":"Tackle"}]}]'
WHERE name='Bugsy';

UPDATE gym_leaders SET type='Normal', badge_name='Plain Badge',
sprite_url='https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/trainers/normal.png',
dialogue='Eu sou Whitney! Minhas fofuras sao poderosas!',
pokemon_list='[{"pokemon_id":35,"name":"Clefairy","level":18,"moves":[{"move_id":100,"name":"Tackle"},{"move_id":47,"name":"Sing"}]},{"pokemon_id":242,"name":"Blissey","level":20,"moves":[{"move_id":100,"name":"Tackle"},{"move_id":103,"name":"Egg Bomb"}]}]'
WHERE name='Whitney';

UPDATE gym_leaders SET type='Ghost', badge_name='Fog Badge',
sprite_url='https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/trainers/ghost.png',
dialogue='Eu sou Morty... meus fantasmas sao assustadores!',
pokemon_list='[{"pokemon_id":93,"name":"Haunter","level":21,"moves":[{"move_id":101,"name":"Lick"},{"move_id":109,"name":"Confuse Ray"}]},{"pokemon_id":94,"name":"Gengar","level":25,"moves":[{"move_id":93,"name":"Poison Gas"},{"move_id":109,"name":"Confuse Ray"}]}]'
WHERE name='Morty';

UPDATE gym_leaders SET type='Fighting', badge_name='Storm Badge',
sprite_url='https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/trainers/fighting.png',
dialogue='Eu sou Chuck! Meus lutadores sao incansaveis!',
pokemon_list='[{"pokemon_id":57,"name":"Primeape","level":27,"moves":[{"move_id":68,"name":"Karate Chop"},{"move_id":99,"name":"Low Kick"}]},{"pokemon_id":62,"name":"Poliwrath","level":27,"moves":[{"move_id":55,"name":"Bubble Beam"},{"move_id":99,"name":"Low Kick"}]}]'
WHERE name='Chuck';

UPDATE gym_leaders SET type='Steel', badge_name='Mineral Badge',
sprite_url='https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/trainers/steel.png',
dialogue='Eu sou Jasmine... meus acos sao resistentes.',
pokemon_list='[{"pokemon_id":208,"name":"Steelix","level":30,"moves":[{"move_id":23,"name":"Iron Tail"},{"move_id":100,"name":"Tackle"}]},{"pokemon_id":125,"name":"Electabuzz","level":30,"moves":[{"move_id":85,"name":"Thunderbolt"},{"move_id":100,"name":"Tackle"}]}]'
WHERE name='Jasmine';

UPDATE gym_leaders SET type='Ice', badge_name='Glacier Badge',
sprite_url='https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/trainers/ice.png',
dialogue='Eu sou Pryce! Meus gelos sao gelidos!',
pokemon_list='[{"pokemon_id":87,"name":"Dewgong","level":32,"moves":[{"move_id":58,"name":"Ice Beam"},{"move_id":55,"name":"Bubble Beam"}]},{"pokemon_id":462,"name":"Magnezone","level":32,"moves":[{"move_id":85,"name":"Thunderbolt"},{"move_id":58,"name":"Ice Beam"}]}]'
WHERE name='Pryce';

UPDATE gym_leaders SET type='Dragon', badge_name='Rising Badge',
sprite_url='https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/trainers/dragon.png',
dialogue='Eu sou Clair! Meus dragoes sao lendarios!',
pokemon_list='[{"pokemon_id":148,"name":"Dragonair","level":35,"moves":[{"move_id":43,"name":"Dragon Rage"},{"move_id":33,"name":"Water Gun"}]},{"pokemon_id":149,"name":"Dragonite","level":40,"moves":[{"move_id":43,"name":"Dragon Rage"},{"move_id":17,"name":"Wing Attack"}]}]'
WHERE name='Clair';
