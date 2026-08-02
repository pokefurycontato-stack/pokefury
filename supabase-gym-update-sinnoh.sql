-- SINNOH
UPDATE gym_leaders SET type='Rock', badge_name='Coal Badge',
sprite_url='https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/trainers/rock.png',
dialogue='Eu sou Roark! Minhas pedras sao indestrutiveis!',
pokemon_list='[{"pokemon_id":44,"name":"Gloom","level":12,"moves":[{"move_id":75,"name":"Razor Leaf"},{"move_id":76,"name":"Vine Whip"}]},{"pokemon_id":77,"name":"Ponyta","level":14,"moves":[{"move_id":44,"name":"Ember"},{"move_id":45,"name":"Fire Spin"}]}]'
WHERE name='Roark';

UPDATE gym_leaders SET type='Grass', badge_name='Forest Badge',
sprite_url='https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/trainers/grass.png',
dialogue='Eu sou Gardenia! Minhas plantas sao encantadoras!',
pokemon_list='[{"pokemon_id":407,"name":"Roserade","level":22,"moves":[{"move_id":75,"name":"Razor Leaf"},{"move_id":76,"name":"Vine Whip"}]},{"pokemon_id":315,"name":"Roselia","level":20,"moves":[{"move_id":75,"name":"Razor Leaf"},{"move_id":76,"name":"Vine Whip"}]}]'
WHERE name='Gardenia';

UPDATE gym_leaders SET type='Ghost', badge_name='Relic Badge',
sprite_url='https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/trainers/ghost.png',
dialogue='Eu sou Fantina! Fantasmas sao elegantes!',
pokemon_list='[{"pokemon_id":429,"name":"Mismagius","level":28,"moves":[{"move_id":101,"name":"Lick"},{"move_id":109,"name":"Confuse Ray"}]},{"pokemon_id":94,"name":"Gengar","level":28,"moves":[{"move_id":93,"name":"Poison Gas"},{"move_id":109,"name":"Confuse Ray"}]}]'
WHERE name='Fantina';

UPDATE gym_leaders SET type='Fighting', badge_name='Cobble Badge',
sprite_url='https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/trainers/fighting.png',
dialogue='Eu sou Maylene! Luta e coragem!',
pokemon_list='[{"pokemon_id":448,"name":"Lucario","level":32,"moves":[{"move_id":68,"name":"Karate Chop"},{"move_id":99,"name":"Low Kick"}]},{"pokemon_id":307,"name":"Meditite","level":30,"moves":[{"move_id":68,"name":"Karate Chop"},{"move_id":99,"name":"Low Kick"}]}]'
WHERE name='Maylene';

UPDATE gym_leaders SET type='Water', badge_name='Fen Badge',
sprite_url='https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/trainers/water.png',
dialogue='Eu sou Crasher Wake! A agua e poderosa!',
pokemon_list='[{"pokemon_id":340,"name":"Whiscash","level":34,"moves":[{"move_id":33,"name":"Water Gun"},{"move_id":106,"name":"Rock Slide"}]},{"pokemon_id":319,"name":"Sharpedo","level":34,"moves":[{"move_id":33,"name":"Water Gun"},{"move_id":44,"name":"Ember"}]}]'
WHERE name='Crasher Wake';

UPDATE gym_leaders SET type='Steel', badge_name='Mine Badge',
sprite_url='https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/trainers/steel.png',
dialogue='Eu sou Byron! Aco resistente!',
pokemon_list='[{"pokemon_id":369,"name":"Relicanth","level":36,"moves":[{"move_id":23,"name":"Iron Tail"},{"move_id":100,"name":"Tackle"}]},{"pokemon_id":423,"name":"Gastrodon","level":36,"moves":[{"move_id":33,"name":"Water Gun"},{"move_id":89,"name":"Rock Throw"}]}]'
WHERE name='Byron';

UPDATE gym_leaders SET type='Ice', badge_name='Icicle Badge',
sprite_url='https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/trainers/ice.png',
dialogue='Eu sou Candice! Gelo e elegancia!',
pokemon_list='[{"pokemon_id":461,"name":"Weavile","level":38,"moves":[{"move_id":58,"name":"Ice Beam"},{"move_id":99,"name":"Low Kick"}]},{"pokemon_id":362,"name":"Glalie","level":38,"moves":[{"move_id":58,"name":"Ice Beam"},{"move_id":100,"name":"Tackle"}]}]'
WHERE name='Candice';

UPDATE gym_leaders SET type='Electric', badge_name='Beacon Badge',
sprite_url='https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/trainers/electric.png',
dialogue='Eu sou Volkner! Raios de poder!',
pokemon_list='[{"pokemon_id":405,"name":"Luxray","level":42,"moves":[{"move_id":85,"name":"Thunderbolt"},{"move_id":100,"name":"Tackle"}]},{"pokemon_id":466,"name":"Electivire","level":42,"moves":[{"move_id":85,"name":"Thunderbolt"},{"move_id":68,"name":"Karate Chop"}]}]'
WHERE name='Volkner';
