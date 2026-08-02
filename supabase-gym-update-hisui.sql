-- HISUI (Wardens)
UPDATE gym_leaders SET type='Rock', badge_name='Grandtree Arena',
sprite_url='https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/trainers/rock.png',
dialogue='Eu sou Lian! Grandtree Arena e minha!',
pokemon_list='[{"pokemon_id":74,"name":"Geodude","level":20,"moves":[{"move_id":89,"name":"Rock Throw"},{"move_id":100,"name":"Tackle"}]},{"pokemon_id":95,"name":"Onix","level":22,"moves":[{"move_id":89,"name":"Rock Throw"},{"move_id":100,"name":"Tackle"}]}]'
WHERE name='Lian';

UPDATE gym_leaders SET type='Fighting', badge_name='Sparkling Cave',
sprite_url='https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/trainers/fighting.png',
dialogue='Eu sou Calaba! Luta ancestral!',
pokemon_list='[{"pokemon_id":66,"name":"Machop","level":18,"moves":[{"move_id":68,"name":"Karate Chop"},{"move_id":99,"name":"Low Kick"}]},{"pokemon_id":68,"name":"Machamp","level":20,"moves":[{"move_id":68,"name":"Karate Chop"},{"move_id":99,"name":"Low Kick"}]}]'
WHERE name='Calaba';

UPDATE gym_leaders SET type='Ghost', badge_name='Old Ruins',
sprite_url='https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/trainers/ghost.png',
dialogue='Eu sou Ingo! Do passado ao presente!',
pokemon_list='[{"pokemon_id":94,"name":"Gengar","level":25,"moves":[{"move_id":93,"name":"Poison Gas"},{"move_id":109,"name":"Confuse Ray"}]},{"pokemon_id":57,"name":"Primeape","level":25,"moves":[{"move_id":68,"name":"Karate Chop"},{"move_id":99,"name":"Low Kick"}]}]'
WHERE name='Ingo';

UPDATE gym_leaders SET type='Dragon', badge_name='Diamond Clan',
sprite_url='https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/trainers/dragon.png',
dialogue='Eu sou Adaman! Diamond Clan e suprema!',
pokemon_list='[{"pokemon_id":448,"name":"Lucario","level":45,"moves":[{"move_id":68,"name":"Karate Chop"},{"move_id":43,"name":"Dragon Rage"}]},{"pokemon_id":445,"name":"Garchomp","level":45,"moves":[{"move_id":43,"name":"Dragon Rage"},{"move_id":23,"name":"Iron Tail"}]}]'
WHERE name='Adaman';

UPDATE gym_leaders SET type='Fairy', badge_name='Pearl Clan',
sprite_url='https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/trainers/fairy.png',
dialogue='Eu sou Iridium! Pearl Clan e eterna!',
pokemon_list='[{"pokemon_id":700,"name":"Sylveon","level":45,"moves":[{"move_id":101,"name":"Lick"},{"move_id":109,"name":"Confuse Ray"}]},{"pokemon_id":196,"name":"Espeon","level":45,"moves":[{"move_id":95,"name":"Psychic"},{"move_id":100,"name":"Tackle"}]}]'
WHERE name='Iridium';

UPDATE gym_leaders SET type='Normal', badge_name='Galaxy Team',
sprite_url='https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/trainers/normal.png',
dialogue='Eu sou Kamado! Galaxy Team lidera Hisui!',
pokemon_list='[{"pokemon_id":448,"name":"Lucario","level":50,"moves":[{"move_id":68,"name":"Karate Chop"},{"move_id":43,"name":"Dragon Rage"}]},{"pokemon_id":445,"name":"Garchomp","level":50,"moves":[{"move_id":43,"name":"Dragon Rage"},{"move_id":23,"name":"Iron Tail"}]}]'
WHERE name='Kamado';
