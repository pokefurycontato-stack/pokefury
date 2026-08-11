-- ============================================================
-- PROGRESSÃO DE NÍVEIS POR REGIÃO
-- Atualiza o pokemon_list de todos os líderes com níveis
-- progressivos de cada região
-- ============================================================

-- Kanto: 12 → 32
UPDATE gym_leaders SET pokemon_list = '[{"name":"Geodude","level":12},{"name":"Onix","level":14}]' WHERE name = 'Brock';
UPDATE gym_leaders SET pokemon_list = '[{"name":"Staryu","level":16},{"name":"Starmie","level":18}]' WHERE name = 'Misty';
UPDATE gym_leaders SET pokemon_list = '[{"name":"Voltorb","level":20},{"name":"Pikachu","level":22},{"name":"Raichu","level":24}]' WHERE name = 'Lt. Surge';
UPDATE gym_leaders SET pokemon_list = '[{"name":"Bellsprout","level":24},{"name":"Weepinbell","level":26},{"name":"Victreebel","level":28}]' WHERE name = 'Erika';
UPDATE gym_leaders SET pokemon_list = '[{"name":"Koffing","level":26},{"name":"Grimer","level":28},{"name":"Muk","level":30},{"name":"Weezing","level":32}]' WHERE name = 'Koga';
UPDATE gym_leaders SET pokemon_list = '[{"name":"Abra","level":28},{"name":"Kadabra","level":30},{"name":"Alakazam","level":32}]' WHERE name = 'Sabrina';
UPDATE gym_leaders SET pokemon_list = '[{"name":"Ninetales","level":30},{"name":"Rapidash","level":32},{"name":"Arcanine","level":34}]' WHERE name = 'Blaine';
UPDATE gym_leaders SET pokemon_list = '[{"name":"Rhyhorn","level":30},{"name":"Nidorino","level":32},{"name":"Nidoqueen","level":34}]' WHERE name = 'Giovanni';

-- Johto: 34 → 48
UPDATE gym_leaders SET pokemon_list = '[{"name":"Pidgey","level":34},{"name":"Pidgeotto","level":36}]' WHERE name = 'Falkner';
UPDATE gym_leaders SET pokemon_list = '[{"name":"Metapod","level":36},{"name":"Kakuna","level":38},{"name":"Scyther","level":40}]' WHERE name = 'Bugsy';
UPDATE gym_leaders SET pokemon_list = '[{"name":"Clefairy","level":38},{"name":"Jigglypuff","level":40},{"name":"Wigglytuff","level":42}]' WHERE name = 'Whitney';
UPDATE gym_leaders SET pokemon_list = '[{"name":"Gastly","level":40},{"name":"Haunter","level":42},{"name":"Gengar","level":44}]' WHERE name = 'Morty';
UPDATE gym_leaders SET pokemon_list = '[{"name":"Machop","level":42},{"name":"Machoke","level":44},{"name":"Poliwrath","level":46}]' WHERE name = 'Chuck';
UPDATE gym_leaders SET pokemon_list = '[{"name":"Magnemite","level":44},{"name":"Magneton","level":46},{"name":"Steelix","level":48}]' WHERE name = 'Jasmine';
UPDATE gym_leaders SET pokemon_list = '[{"name":"Seel","level":44},{"name":"Dewgong","level":46},{"name":"Piloswine","level":48}]' WHERE name = 'Pryce';
UPDATE gym_leaders SET pokemon_list = '[{"name":"Horsea","level":46},{"name":"Seadra","level":48},{"name":"Kingdra","level":50}]' WHERE name = 'Clair';

-- Hoenn: 50 → 64
UPDATE gym_leaders SET pokemon_list = '[{"name":"Geodude","level":50},{"name":"Nosepass","level":52}]' WHERE name = 'Roxanne';
UPDATE gym_leaders SET pokemon_list = '[{"name":"Machop","level":52},{"name":"Makuhita","level":54},{"name":"Hariyama","level":56}]' WHERE name = 'Brawly';
UPDATE gym_leaders SET pokemon_list = '[{"name":"Voltorb","level":54},{"name":"Magnemite","level":56},{"name":"Electrode","level":58}]' WHERE name = 'Wattson';
UPDATE gym_leaders SET pokemon_list = '[{"name":"Numel","level":56},{"name":"Camerupt","level":58},{"name":"Torkoal","level":60}]' WHERE name = 'Flannery';
UPDATE gym_leaders SET pokemon_list = '[{"name":"Slaking","level":58},{"name":"Linoone","level":60},{"name":"Vigoroth","level":62}]' WHERE name = 'Norman';
UPDATE gym_leaders SET pokemon_list = '[{"name":"Swablu","level":60},{"name":"Altaria","level":62},{"name":"Skarmory","level":64}]' WHERE name = 'Winona';
UPDATE gym_leaders SET pokemon_list = '[{"name":"Solrock","level":62},{"name":"Lunatone","level":64}]' WHERE name = 'Tate and Liza';
UPDATE gym_leaders SET pokemon_list = '[{"name":"Luvdisc","level":62},{"name":"Gorebyss","level":64},{"name":"Milotic","level":66}]' WHERE name = 'Wallace';

-- Sinnoh: 66 → 80
UPDATE gym_leaders SET pokemon_list = '[{"name":"Geodude","level":66},{"name":"Cranidos","level":68},{"name":"Rampardos","level":70}]' WHERE name = 'Roark';
UPDATE gym_leaders SET pokemon_list = '[{"name":"Budew","level":68},{"name":"Roserade","level":70}]' WHERE name = 'Gardenia';
UPDATE gym_leaders SET pokemon_list = '[{"name":"Drifloon","level":70},{"name":"Mismagius","level":72}]' WHERE name = 'Fantina';
UPDATE gym_leaders SET pokemon_list = '[{"name":"Meditite","level":72},{"name":"Machoke","level":74},{"name":"Lucario","level":76}]' WHERE name = 'Maylene';
UPDATE gym_leaders SET pokemon_list = '[{"name":"Shellos","level":74},{"name":"Gastrodon","level":76},{"name":"Floatzel","level":78}]' WHERE name = 'Crasher Wake';
UPDATE gym_leaders SET pokemon_list = '[{"name":"Bronzor","level":76},{"name":"Steelix","level":78},{"name":"Bastiodon","level":80}]' WHERE name = 'Byron';
UPDATE gym_leaders SET pokemon_list = '[{"name":"Snover","level":78},{"name":"Abomasnow","level":80}]' WHERE name = 'Candice';
UPDATE gym_leaders SET pokemon_list = '[{"name":"Jolteon","level":78},{"name":"Luxray","level":80},{"name":"Electivire","level":82}]' WHERE name = 'Volkner';

-- Unova: 82 → 90
UPDATE gym_leaders SET pokemon_list = '[{"name":"Lillipup","level":82},{"name":"Pansage","level":84},{"name":"Simisage","level":86}]' WHERE name = 'Cilan';
UPDATE gym_leaders SET pokemon_list = '[{"name":"Watchog","level":84},{"name":"Herdier","level":86},{"name":"Stoutland","level":88}]' WHERE name = 'Lenora';
UPDATE gym_leaders SET pokemon_list = '[{"name":"Dwebble","level":85},{"name":"Leavanny","level":87},{"name":"Venipede","level":89}]' WHERE name = 'Burgh';
UPDATE gym_leaders SET pokemon_list = '[{"name":"Emolga","level":86},{"name":"Flaaffy","level":88},{"name":"Ampharos","level":90}]' WHERE name = 'Elesa';
UPDATE gym_leaders SET pokemon_list = '[{"name":"Krokorok","level":87},{"name":"Claydol","level":89},{"name":"Excadrill","level":91}]' WHERE name = 'Clay';
UPDATE gym_leaders SET pokemon_list = '[{"name":"Swoobat","level":88},{"name":"Unfezant","level":90},{"name":"Braviary","level":92}]' WHERE name = 'Skyla';
UPDATE gym_leaders SET pokemon_list = '[{"name":"Cryogonal","level":89},{"name":"Beartic","level":91},{"name":"Vanilluxe","level":93}]' WHERE name = 'Brycen';
UPDATE gym_leaders SET pokemon_list = '[{"name":"Druddigon","level":90},{"name":"Flygon","level":92},{"name":"Haxorus","level":94}]' WHERE name = 'Drayden';

-- Kalos: 91 → 97
UPDATE gym_leaders SET pokemon_list = '[{"name":"Scatterbug","level":91},{"name":"Spewpa","level":93},{"name":"Vivillon","level":95}]' WHERE name = 'Viola';
UPDATE gym_leaders SET pokemon_list = '[{"name":"Litleo","level":92},{"name":"Tyrunt","level":94},{"name":"Amaura","level":96}]' WHERE name = 'Grant';
UPDATE gym_leaders SET pokemon_list = '[{"name":"Hawlucha","level":93},{"name":"Tyrogue","level":95},{"name":"Lucario","level":97}]' WHERE name = 'Korrina';
UPDATE gym_leaders SET pokemon_list = '[{"name":"Weepinbell","level":94},{"name":"Gogoat","level":96}]' WHERE name = 'Ramos';
UPDATE gym_leaders SET pokemon_list = '[{"name":"Mewtwo","level":95},{"name":"Mr. Mime","level":97}]' WHERE name = 'Valerie';
UPDATE gym_leaders SET pokemon_list = '[{"name":"Espurr","level":96},{"name":"Meowstic","level":98}]' WHERE name = 'Olympia';
UPDATE gym_leaders SET pokemon_list = '[{"name":"Snorunt","level":97},{"name":"Glalie","level":99},{"name":"Avalugg","level":100}]' WHERE name = 'Wulfric';

-- Alola: 92 → 98
UPDATE gym_leaders SET pokemon_list = '[{"name":"Mienfoo","level":92},{"name":"Hawlucha","level":94},{"name":"Kommo-o","level":96}]' WHERE name = 'Hala';
UPDATE gym_leaders SET pokemon_list = '[{"name":"Nosepass","level":93},{"name":"Probopass","level":95},{"name":"Golem","level":97}]' WHERE name = 'Olivia';
UPDATE gym_leaders SET pokemon_list = '[{"name":"Sableye","level":94},{"name":"Absol","level":96},{"name":"Krookodile","level":98}]' WHERE name = 'Nanu';
UPDATE gym_leaders SET pokemon_list = '[{"name":"Trapinch","level":95},{"name":"Flygon","level":97},{"name":"Garchomp","level":99}]' WHERE name = 'Hapu';

-- Galar: 93 → 100
UPDATE gym_leaders SET pokemon_list = '[{"name":"Gossifleur","level":93},{"name":"Eldegoss","level":95}]' WHERE name = 'Milo';
UPDATE gym_leaders SET pokemon_list = '[{"name":"Dewpider","level":94},{"name":"Araquanid","level":96}]' WHERE name = 'Nessa';
UPDATE gym_leaders SET pokemon_list = '[{"name":"Sizzlipede","level":95},{"name":"Centiskorch","level":97}]' WHERE name = 'Kabu';
UPDATE gym_leaders SET pokemon_list = '[{"name":"Machop","level":96},{"name":"Machoke","level":98},{"name":"Machamp","level":100}]' WHERE name = 'Bea';
UPDATE gym_leaders SET pokemon_list = '[{"name":"Wooloo","level":97},{"name":"Dubwool","level":99}]' WHERE name = 'Opal';
UPDATE gym_leaders SET pokemon_list = '[{"name":"Rolycoly","level":97},{"name":"Carkol","level":99},{"name":"Coalossal","level":100}]' WHERE name = 'Gordie';
UPDATE gym_leaders SET pokemon_list = '[{"name":"Impidimp","level":98},{"name":"Morgrem","level":100},{"name":"Grimmsnarl","level":101}]' WHERE name = 'Piers';
UPDATE gym_leaders SET pokemon_list = '[{"name":"Duraludon","level":99},{"name":"Tyranitar","level":101},{"name":"Dragonite","level":102}]' WHERE name = 'Raihan';

-- Hisui: 95 → 100
UPDATE gym_leaders SET pokemon_list = '[{"name":"Geodude","level":95},{"name":"Kleavor","level":97}]' WHERE name = 'Lian';
UPDATE gym_leaders SET pokemon_list = '[{"name":"Staraptor","level":96},{"name":"Steelix","level":98}]' WHERE name = 'Calaba';
UPDATE gym_leaders SET pokemon_list = '[{"name":"Hisuian Braviary","level":97},{"name":"Sneasler","level":99}]' WHERE name = 'Ingo';
UPDATE gym_leaders SET pokemon_list = '[{"name":"Lucario","level":97},{"name":"Ursaluna","level":99}]' WHERE name = 'Adaman';
UPDATE gym_leaders SET pokemon_list = '[{"name":"Weavile","level":98},{"name":"Electivire","level":100}]' WHERE name = 'Iridium';
UPDATE gym_leaders SET pokemon_list = '[{"name":"Garchomp","level":99},{"name":"Arcanine","level":101},{"name":"Typhlosion","level":102}]' WHERE name = 'Kamado';

-- Paldea: 96 → 100
UPDATE gym_leaders SET pokemon_list = '[{"name":"Tarountula","level":96},{"name":"Nymble","level":98},{"name":"Lokix","level":100}]' WHERE name = 'Katy';
UPDATE gym_leaders SET pokemon_list = '[{"name":"Smoliv","level":97},{"name":"Bramblin","level":99},{"name":"Brambleghast","level":100}]' WHERE name = 'Brassius';
UPDATE gym_leaders SET pokemon_list = '[{"name":"Wattrel","level":97},{"name":"Bellibolt","level":99},{"name":"Mismagius","level":100}]' WHERE name = 'Iono';
UPDATE gym_leaders SET pokemon_list = '[{"name":"Wailmer","level":98},{"name":"Clobbopus","level":100},{"name":"Wailord","level":101}]' WHERE name = 'Kofu';
UPDATE gym_leaders SET pokemon_list = '[{"name":"Killowattrel","level":98},{"name":"Flamigo","level":100},{"name":"Komala","level":100}]' WHERE name = 'Larry';
UPDATE gym_leaders SET pokemon_list = '[{"name":"Mimikyu","level":99},{"name":"Gengar","level":100},{"name":"Houndstone","level":100}]' WHERE name = 'Ryme';
UPDATE gym_leaders SET pokemon_list = '[{"name":"Espurr","level":99},{"name":"Forretress","level":100},{"name":"Gardevoir","level":100}]' WHERE name = 'Tulip';
UPDATE gym_leaders SET pokemon_list = '[{"name":"Snom","level":99},{"name":"Cetoddle","level":100},{"name":"Altaria","level":100}]' WHERE name = 'Grusha';
