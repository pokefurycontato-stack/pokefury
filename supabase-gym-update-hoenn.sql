-- HOENN
UPDATE gym_leaders SET type='Rock', badge_name='Stone Badge',
sprite_url='https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/trainers/rock.png',
dialogue='Eu sou Roxanne! Pedras sao inquebraveis!',
pokemon_list='[{"pokemon_id":299,"name":"Nosepass","level":12,"moves":[{"move_id":89,"name":"Rock Throw"},{"move_id":100,"name":"Tackle"}]}]'
WHERE name='Roxanne';

UPDATE gym_leaders SET type='Fighting', badge_name='Knuckle Badge',
sprite_url='https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/trainers/fighting.png',
dialogue='Eu sou Brawly! Ondas de combate!',
pokemon_list='[{"pokemon_id":66,"name":"Machop","level":16,"moves":[{"move_id":68,"name":"Karate Chop"},{"move_id":99,"name":"Low Kick"}]},{"pokemon_id":8,"name":"Wartortle","level":15,"moves":[{"move_id":33,"name":"Water Gun"},{"move_id":55,"name":"Bubble Beam"}]}]'
WHERE name='Brawly';

UPDATE gym_leaders SET type='Electric', badge_name='Dynamo Badge',
sprite_url='https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/trainers/electric.png',
dialogue='Eu sou Wattson! Wahahahaha!',
pokemon_list='[{"pokemon_id":82,"name":"Magneton","level":20,"moves":[{"move_id":85,"name":"Thunderbolt"},{"move_id":84,"name":"Thunder Shock"}]},{"pokemon_id":100,"name":"Electrode","level":20,"moves":[{"move_id":85,"name":"Thunderbolt"},{"move_id":100,"name":"Tackle"}]}]'
WHERE name='Wattson';

UPDATE gym_leaders SET type='Fire', badge_name='Heat Badge',
sprite_url='https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/trainers/fire.png',
dialogue='Eu sou Flannery! Chamas ardentes!',
pokemon_list='[{"pokemon_id":219,"name":"Magcargo","level":24,"moves":[{"move_id":44,"name":"Ember"},{"move_id":106,"name":"Rock Slide"}]},{"pokemon_id":323,"name":"Camerupt","level":24,"moves":[{"move_id":44,"name":"Ember"},{"move_id":39,"name":"Take Down"}]}]'
WHERE name='Flannery';

UPDATE gym_leaders SET type='Normal', badge_name='Balance Badge',
sprite_url='https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/trainers/normal.png',
dialogue='Eu sou Norman! Normal nao significa fraco!',
pokemon_list='[{"pokemon_id":289,"name":"Slaking","level":28,"moves":[{"move_id":100,"name":"Tackle"},{"move_id":39,"name":"Take Down"}]},{"pokemon_id":288,"name":"Vigoroth","level":28,"moves":[{"move_id":100,"name":"Tackle"},{"move_id":68,"name":"Karate Chop"}]}]'
WHERE name='Norman';

UPDATE gym_leaders SET type='Flying', badge_name='Feather Badge',
sprite_url='https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/trainers/flying.png',
dialogue='Eu sou Winona! Voando alto!',
pokemon_list='[{"pokemon_id":279,"name":"Pelipper","level":29,"moves":[{"move_id":55,"name":"Bubble Beam"},{"move_id":17,"name":"Wing Attack"}]},{"pokemon_id":373,"name":"Salamence","level":33,"moves":[{"move_id":43,"name":"Dragon Rage"},{"move_id":17,"name":"Wing Attack"}]}]'
WHERE name='Winona';

UPDATE gym_leaders SET type='Psychic', badge_name='Mind Badge',
sprite_url='https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/trainers/psychic.png',
dialogue='Nos somos Tate e Liza! Nossas mentes se conectam!',
pokemon_list='[{"pokemon_id":337,"name":"Lunatone","level":40,"moves":[{"move_id":95,"name":"Psychic"},{"move_id":89,"name":"Rock Throw"}]},{"pokemon_id":338,"name":"Solrock","level":40,"moves":[{"move_id":95,"name":"Psychic"},{"move_id":89,"name":"Rock Throw"}]}]'
WHERE name='Tate and Liza';

UPDATE gym_leaders SET type='Water', badge_name='Rain Badge',
sprite_url='https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/trainers/water.png',
dialogue='Eu sou Wallace! A elegancia da agua!',
pokemon_list='[{"pokemon_id":373,"name":"Salamence","level":42,"moves":[{"move_id":43,"name":"Dragon Rage"},{"move_id":17,"name":"Wing Attack"}]},{"pokemon_id":130,"name":"Gyarados","level":42,"moves":[{"move_id":33,"name":"Water Gun"},{"move_id":44,"name":"Ember"}]}]'
WHERE name='Wallace';
