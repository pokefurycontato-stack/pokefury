-- =============================================
-- SETUP COMPLETO: items table + FK + seed
-- =============================================

-- 1. Garantir que a tabela items existe com colunas corretas
CREATE TABLE IF NOT EXISTS items (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    category TEXT NOT NULL,
    subcategory TEXT,
    effect TEXT,
    effect_value NUMERIC DEFAULT 0,
    description TEXT,
    price INTEGER DEFAULT 0,
    sprite_url TEXT,
    holdable BOOLEAN DEFAULT false,
    usable_in_battle BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Adicionar colunas que podem estar faltando
ALTER TABLE items ADD COLUMN IF NOT EXISTS subcategory TEXT;
ALTER TABLE items ADD COLUMN IF NOT EXISTS effect TEXT;
ALTER TABLE items ADD COLUMN IF NOT EXISTS effect_value NUMERIC DEFAULT 0;
ALTER TABLE items ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE items ADD COLUMN IF NOT EXISTS sprite_url TEXT;
ALTER TABLE items ADD COLUMN IF NOT EXISTS holdable BOOLEAN DEFAULT false;
ALTER TABLE items ADD COLUMN IF NOT EXISTS usable_in_battle BOOLEAN DEFAULT false;

-- 3. Popular TODOS os itens
INSERT INTO items (id, name, category, subcategory, effect, effect_value, description, price, sprite_url, holdable, usable_in_battle) VALUES
-- Poções / Medicine
(1, 'Potion', 'medicine', 'heal', 'heal_20', 20, 'Cura 20 HP.', 300, 'assets/sprites/items/potion.png', false, true),
(2, 'Super Potion', 'medicine', 'heal', 'heal_50', 50, 'Cura 50 HP.', 700, 'assets/sprites/items/super-potion.png', false, true),
(3, 'Hyper Potion', 'medicine', 'heal', 'heal_200', 200, 'Cura 200 HP.', 1200, 'assets/sprites/items/hyper-potion.png', false, true),
(4, 'Max Potion', 'medicine', 'heal', 'heal_full', 9999, 'Cura todo HP.', 2500, 'assets/sprites/items/max-potion.png', false, true),
(5, 'Full Restore', 'medicine', 'heal', 'heal_full_status', 9999, 'Cura todo HP e status.', 3000, 'assets/sprites/items/full-restore.png', false, true),
(20, 'Revive', 'medicine', 'revive', 'revive_half', 0.5, 'Revive com metade HP.', 1500, 'assets/sprites/items/revive.png', false, false),
(21, 'Max Revive', 'medicine', 'revive', 'revive_full', 1, 'Revive com HP total.', 3000, 'assets/sprites/items/max-revive.png', false, false),
(30, 'Antidote', 'medicine', 'status', 'cure_poison', 0, 'Cura envenenamento.', 100, 'assets/sprites/items/antidote.png', false, true),
(31, 'Paralyze Heal', 'medicine', 'status', 'cure_paralyze', 0, 'Cura paralisia.', 200, 'assets/sprites/items/paralyze-heal.png', false, true),
(32, 'Awakening', 'medicine', 'status', 'cure_sleep', 0, 'Acorda Pokemon.', 200, 'assets/sprites/items/awakening.png', false, true),
(33, 'Burn Heal', 'medicine', 'status', 'cure_burn', 0, 'Cura queimadura.', 200, 'assets/sprites/items/burn-heal.png', false, true),
(34, 'Ice Heal', 'medicine', 'status', 'cure_freeze', 0, 'Descongela.', 200, 'assets/sprites/items/ice-heal.png', false, true),
(35, 'Full Heal', 'medicine', 'status', 'cure_all_status', 0, 'Cura qualquer status.', 400, 'assets/sprites/items/full-heal.png', false, true),
(40, 'Rare Candy', 'medicine', 'exp', 'level_up', 1, '+1 nivel.', 10000, 'assets/sprites/items/rare-candy.png', false, false),
(70, 'Exp Candy XS', 'medicine', 'exp', 'exp_100', 100, '+100 EXP.', 0, 'assets/sprites/items/exp-candy-xs.png', false, false),
(71, 'Exp Candy S', 'medicine', 'exp', 'exp_500', 500, '+500 EXP.', 0, 'assets/sprites/items/exp-candy-s.png', false, false),
(72, 'Exp Candy M', 'medicine', 'exp', 'exp_1200', 1200, '+1200 EXP.', 0, 'assets/sprites/items/exp-candy-m.png', false, false),
(73, 'Exp Candy L', 'medicine', 'exp', 'exp_3000', 3000, '+3000 EXP.', 0, 'assets/sprites/items/exp-candy-l.png', false, false),
(74, 'Exp Candy XL', 'medicine', 'exp', 'exp_10000', 10000, '+10000 EXP.', 0, 'assets/sprites/items/exp-candy-xl.png', false, false),
(80, 'HP Up', 'medicine', 'ev', 'ev_hp', 1, '+1 EV HP por uso.', 10000, 'assets/sprites/items/hp-up.png', false, false),
(81, 'Protein', 'medicine', 'ev', 'ev_attack', 1, '+1 EV Ataque.', 10000, 'assets/sprites/items/protein.png', false, false),
(82, 'Iron', 'medicine', 'ev', 'ev_defense', 1, '+1 EV Defesa.', 10000, 'assets/sprites/items/iron.png', false, false),
(83, 'Zinc', 'medicine', 'ev', 'ev_sp_atk', 1, '+1 EV Sp.Atk.', 10000, 'assets/sprites/items/zinc.png', false, false),
(84, 'Calcium', 'medicine', 'ev', 'ev_sp_def', 1, '+1 EV Sp.Def.', 10000, 'assets/sprites/items/calcium.png', false, false),
(85, 'Carbos', 'medicine', 'ev', 'ev_speed', 1, '+1 EV Speed.', 10000, 'assets/sprites/items/carbos.png', false, false),

-- Pokébolas
(10, 'Poké Ball', 'pokeball', 'standard', 'catch_1x', 1, 'Pokébola básica.', 200, 'assets/sprites/items/poke-ball.png', false, true),
(11, 'Great Ball', 'pokeball', 'standard', 'catch_1.5x', 1.5, 'Maior chance.', 600, 'assets/sprites/items/great-ball.png', false, true),
(12, 'Ultra Ball', 'pokeball', 'standard', 'catch_2x', 2, 'Alta chance.', 1200, 'assets/sprites/items/ultra-ball.png', false, true),
(13, 'Master Ball', 'pokeball', 'master', 'catch_100x', 100, 'Captura sempre.', 0, 'assets/sprites/items/master-ball.png', false, true),

-- Battle Items
(50, 'X Attack', 'battle_item', 'stat', 'boost_attack', 0, '+1 ataque na batalha.', 500, 'assets/sprites/items/x-attack.png', false, true),
(51, 'X Defense', 'battle_item', 'stat', 'boost_defense', 0, '+1 defesa na batalha.', 550, 'assets/sprites/items/x-defense.png', false, true),
(52, 'X Speed', 'battle_item', 'stat', 'boost_speed', 0, '+1 velocidade.', 350, 'assets/sprites/items/x-speed.png', false, true),
(53, 'X Sp. Atk', 'battle_item', 'stat', 'boost_sp_atk', 0, '+1 sp.atk.', 350, 'assets/sprites/items/x-sp-atk.png', false, true),
(54, 'X Sp. Def', 'battle_item', 'stat', 'boost_sp_def', 0, '+1 sp.def.', 350, 'assets/sprites/items/x-sp-def.png', false, true),
(55, 'Dire Hit', 'battle_item', 'crit', 'boost_crit', 0, 'Aumenta chance de crit.', 650, 'assets/sprites/items/dire-hit.png', false, true),

-- Field Items
(60, 'Escape Rope', 'field', 'escape', 'escape', 0, 'Sai de cavernas.', 550, 'assets/sprites/items/escape-rope.png', false, false),

-- Exp Share
(99, 'Exp. Share', 'held_item', 'exp', 'exp_share', 0, 'Divide EXP igualmente.', 3000, 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/exp-share.png', true, false),

-- Evolution Stones
(100, 'Fire Stone', 'evolution_stone', 'evolve_fire', 'evolve_fire', 0, 'Evolui Vulpix, Growlithe, Eevee.', 2100, 'assets/sprites/items/fire-stone.png', false, false),
(101, 'Water Stone', 'evolution_stone', 'evolve_water', 'evolve_water', 0, 'Evolui Poliwhirl, Shellder, Staryu, Eevee.', 2100, 'assets/sprites/items/water-stone.png', false, false),
(102, 'Thunder Stone', 'evolution_stone', 'evolve_thunder', 'evolve_thunder', 0, 'Evolui Pikachu, Eevee.', 2100, 'assets/sprites/items/thunder-stone.png', false, false),
(103, 'Leaf Stone', 'evolution_stone', 'evolve_grass', 'evolve_grass', 0, 'Evolui Gloom, Weepinbell, Exeggcute.', 2100, 'assets/sprites/items/leaf-stone.png', false, false),
(104, 'Ice Stone', 'evolution_stone', 'evolve_ice', 'evolve_ice', 0, 'Evolui Alolan Vulpix, Alolan Sandshrew.', 2100, 'assets/sprites/items/ice-stone.png', false, false),
(105, 'Moon Stone', 'evolution_stone', 'evolve_moon', 'evolve_moon', 0, 'Evolui Nidorina, Nidorino, Clefairy, Jigglypuff.', 2100, 'assets/sprites/items/moon-stone.png', false, false),
(106, 'Sun Stone', 'evolution_stone', 'evolve_sun', 'evolve_sun', 0, 'Evolui Gloom, Cottonee, Petilil.', 2100, 'assets/sprites/items/sun-stone.png', false, false),
(107, 'Shiny Stone', 'evolution_stone', 'evolve_shiny', 'evolve_shiny', 0, 'Evolui Togetic, Roselia, Minccino.', 2100, 'assets/sprites/items/shiny-stone.png', false, false),
(108, 'Dusk Stone', 'evolution_stone', 'evolve_dusk', 'evolve_dusk', 0, 'Evolui Murkrow, Lampent, Doublade.', 2100, 'assets/sprites/items/dusk-stone.png', false, false),
(109, 'Dawn Stone', 'evolution_stone', 'evolve_dawn', 'evolve_dawn', 0, 'Evolui Male Kirlia, Female Snorunt.', 2100, 'assets/sprites/items/dawn-stone.png', false, false),
(110, 'Oval Stone', 'evolution_stone', 'evolve_oval', 'evolve_oval', 0, 'Evolui Happiny com amizade+dia.', 2100, 'assets/sprites/items/oval-stone.png', false, false),
(111, 'Sweet Apple', 'evolution_stone', 'evolve_sweet', 'evolve_sweet', 0, 'Evolui Applin em Appletun.', 2200, 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/sweet-apple.png', false, false),
(112, 'Tart Apple', 'evolution_stone', 'evolve_tart', 'evolve_tart', 0, 'Evolui Applin em Flapple.', 2200, 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/tart-apple.png', false, false),

-- Held Items
(201, 'Leftovers', 'held', 'recovery', 'leftovers', 0, 'Cura 1/16 HP por turno.', 0, 'assets/sprites/items/leftovers.png', true, true),
(202, 'Choice Band', 'held', 'offensive', 'choice_band', 0, '+50% ATK, fixa 1 golpe.', 0, 'assets/sprites/items/choice-band.png', true, true),
(203, 'Choice Specs', 'held', 'offensive', 'choice_specs', 0, '+50% SP.ATK, fixa 1 golpe.', 0, 'assets/sprites/items/choice-specs.png', true, true),
(204, 'Choice Scarf', 'held', 'speed', 'choice_scarf', 0, '+50% SPEED, fixa 1 golpe.', 0, 'assets/sprites/items/choice-scarf.png', true, true),
(205, 'Life Orb', 'held', 'offensive', 'life_orb', 0, '+30% dano, -10% HP por ataque.', 0, 'assets/sprites/items/life-orb.png', true, true),
(206, 'Focus Sash', 'held', 'defensive', 'focus_sash', 0, 'Sobrevive com 1 HP (1x).', 0, 'assets/sprites/items/focus-sash.png', true, true),
(207, 'Expert Belt', 'held', 'offensive', 'expert_belt', 0, '+20% em golpes SE.', 0, 'assets/sprites/items/expert-belt.png', true, true),
(208, 'Rocky Helmet', 'held', 'defensive', 'rocky_helmet', 0, 'Machuca atacante em 1/6 HP.', 0, 'assets/sprites/items/rocky-helmet.png', true, true),
(209, 'Shell Bell', 'held', 'recovery', 'shell_bell', 0, 'Cura 1/8 do dano causado.', 0, 'assets/sprites/items/shell-bell.png', true, true),
(210, 'Assault Vest', 'held', 'defensive', 'assault_vest', 0, '+50% SP.DEF, sem status.', 0, 'assets/sprites/items/assault-vest.png', true, true),
(211, 'Eviolite', 'held', 'defensive', 'eviolite', 0, '+50% DEF/SP.DEF (pre-evo).', 0, 'assets/sprites/items/eviolite.png', true, true),
(212, 'Macho Brace', 'held', 'ev', 'macho_brace', 0, 'Dobra EVs, -50% Speed.', 0, 'assets/sprites/items/macho-brace.png', true, false),
(213, 'Power Weight', 'held', 'ev', 'power_weight', 0, '+4 EVs HP, -50% Speed.', 3200, 'assets/sprites/items/power-weight.png', true, false),
(214, 'Power Bracer', 'held', 'ev', 'power_bracer', 0, '+4 EVs ATK, -50% Speed.', 3200, 'assets/sprites/items/power-bracer.png', true, false),
(215, 'Power Belt', 'held', 'ev', 'power_belt', 0, '+4 EVs DEF, -50% Speed.', 3200, 'assets/sprites/items/power-belt.png', true, false),
(216, 'Power Lens', 'held', 'ev', 'power_lens', 0, '+4 EVs SP.ATK, -50% Speed.', 3200, 'assets/sprites/items/power-lens.png', true, false),
(217, 'Power Band', 'held', 'ev', 'power_band', 0, '+4 EVs SP.DEF, -50% Speed.', 3200, 'assets/sprites/items/power-band.png', true, false),
(218, 'Power Anklet', 'held', 'ev', 'power_anklet', 0, '+4 EVs SPD, -50% Speed.', 3200, 'assets/sprites/items/power-anklet.png', true, false),
(219, 'Lucky Egg', 'held', 'exp', 'lucky_egg', 0, '+50% EXP.', 0, 'assets/sprites/items/lucky-egg.png', true, true),
(220, 'Amulet Coin', 'held', 'money', 'amulet_coin', 0, 'Dobra dinheiro.', 0, 'assets/sprites/items/amulet-coin.png', true, true),
(221, 'Quick Claw', 'held', 'priority', 'quick_claw', 0, '20% de atacar primeiro.', 0, 'assets/sprites/items/quick-claw.png', true, true),
(222, 'Focus Band', 'held', 'defensive', 'focus_band', 0, '30% sobrevive 1 HP.', 0, 'assets/sprites/items/focus-band.png', true, true),
(223, 'Wide Lens', 'held', 'accuracy', 'wide_lens', 0, '+10% acerto.', 0, 'assets/sprites/items/wide-lens.png', true, true),
(224, 'Muscle Band', 'held', 'offensive', 'muscle_band', 0, '+10% golpes fisicos.', 0, 'assets/sprites/items/muscle-band.png', true, true),
(225, 'Wise Glasses', 'held', 'offensive', 'wise_glasses', 0, '+10% golpes especiais.', 0, 'assets/sprites/items/wise-glasses.png', true, true),
(226, 'Smoke Ball', 'held', 'utility', 'smoke_ball', 0, 'Fuga garantida.', 0, 'assets/sprites/items/smoke-ball.png', true, true),
(227, 'Lum Berry', 'held', 'berry', 'lum_berry', 0, 'Cura status uma vez.', 0, 'assets/sprites/items/lum-berry.png', true, true),
(228, 'Sitrus Berry', 'held', 'berry', 'sitrus_berry', 0, 'Cura 25% HP (1x, <50% HP).', 0, 'assets/sprites/items/sitrus-berry.png', true, true),
(229, 'Oran Berry', 'held', 'berry', 'oran_berry', 0, 'Cura 10 HP (1x).', 0, 'assets/sprites/items/oran-berry.png', true, true),
(230, 'Figy Berry', 'held', 'berry', 'figy_berry', 0, 'Cura 33% HP mas confunde.', 0, 'assets/sprites/items/figy-berry.png', true, true),
(231, 'Wiki Berry', 'held', 'berry', 'wiki_berry', 0, 'Cura 33% HP mas confunde.', 0, 'assets/sprites/items/wiki-berry.png', true, true),
(232, 'Mago Berry', 'held', 'berry', 'mago_berry', 0, 'Cura 33% HP mas confunde.', 0, 'assets/sprites/items/mago-berry.png', true, true),
(233, 'Aguav Berry', 'held', 'berry', 'aguav_berry', 0, 'Cura 33% HP mas confunde.', 0, 'assets/sprites/items/aguav-berry.png', true, true),
(234, 'Iapapa Berry', 'held', 'berry', 'iapapa_berry', 0, 'Cura 33% HP mas confunde.', 0, 'assets/sprites/items/iapapa-berry.png', true, true)

ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    category = EXCLUDED.category,
    subcategory = EXCLUDED.subcategory,
    effect = EXCLUDED.effect,
    effect_value = EXCLUDED.effect_value,
    description = EXCLUDED.description,
    price = EXCLUDED.price,
    sprite_url = EXCLUDED.sprite_url,
    holdable = EXCLUDED.holdable,
    usable_in_battle = EXCLUDED.usable_in_battle;

-- 4. Mega Stones
INSERT INTO items (id, name, category, subcategory, effect, effect_value, description, price, sprite_url, holdable, usable_in_battle) VALUES
(1001, 'Venusaurite', 'mega_stone', NULL, 'mega_venusaur', 0, 'Mega-evolui Venusaur.', 0, 'assets/sprites/items/venusaurite.png', true, false),
(1002, 'Charizardite X', 'mega_stone', NULL, 'mega_charizard_x', 0, 'Mega-evolui Charizard X.', 0, 'assets/sprites/items/charizardite-x.png', true, false),
(1003, 'Charizardite Y', 'mega_stone', NULL, 'mega_charizard_y', 0, 'Mega-evolui Charizard Y.', 0, 'assets/sprites/items/charizardite-y.png', true, false),
(1004, 'Blastoisinite', 'mega_stone', NULL, 'mega_blastoise', 0, 'Mega-evolui Blastoise.', 0, 'assets/sprites/items/blastoisinite.png', true, false),
(1005, 'Alakazite', 'mega_stone', NULL, 'mega_alakazam', 0, 'Mega-evolui Alakazam.', 0, 'assets/sprites/items/alakazite.png', true, false),
(1006, 'Gengarite', 'mega_stone', NULL, 'mega_gengar', 0, 'Mega-evolui Gengar.', 0, 'assets/sprites/items/gengarite.png', true, false),
(1007, 'Kangaskhanite', 'mega_stone', NULL, 'mega_kangaskhan', 0, 'Mega-evolui Kangaskhan.', 0, 'assets/sprites/items/kangaskhanite.png', true, false),
(1008, 'Pinsirite', 'mega_stone', NULL, 'mega_pinsir', 0, 'Mega-evolui Pinsir.', 0, 'assets/sprites/items/pinsirite.png', true, false),
(1009, 'Gyaradosite', 'mega_stone', NULL, 'mega_gyarados', 0, 'Mega-evolui Gyarados.', 0, 'assets/sprites/items/gyaradosite.png', true, false),
(1010, 'Aerodactylite', 'mega_stone', NULL, 'mega_aerodactyl', 0, 'Mega-evolui Aerodactyl.', 0, 'assets/sprites/items/aerodactylite.png', true, false),
(1011, 'Mewtwonite X', 'mega_stone', NULL, 'mega_mewtwo_x', 0, 'Mega-evolui Mewtwo X.', 0, 'assets/sprites/items/mewtwonite-x.png', true, false),
(1012, 'Mewtwonite Y', 'mega_stone', NULL, 'mega_mewtwo_y', 0, 'Mega-evolui Mewtwo Y.', 0, 'assets/sprites/items/mewtwonite-y.png', true, false),
(1013, 'Scizorite', 'mega_stone', NULL, 'mega_scizor', 0, 'Mega-evolui Scizor.', 0, 'assets/sprites/items/scizorite.png', true, false),
(1014, 'Heracronite', 'mega_stone', NULL, 'mega_heracross', 0, 'Mega-evolui Heracross.', 0, 'assets/sprites/items/heracronite.png', true, false),
(1015, 'Houndoominite', 'mega_stone', NULL, 'mega_houndoom', 0, 'Mega-evolui Houndoom.', 0, 'assets/sprites/items/houndoominite.png', true, false),
(1016, 'Tyranitarite', 'mega_stone', NULL, 'mega_tyranitar', 0, 'Mega-evolui Tyranitar.', 0, 'assets/sprites/items/tyranitarite.png', true, false),
(1017, 'Blazikenite', 'mega_stone', NULL, 'mega_blaziken', 0, 'Mega-evolui Blaziken.', 0, 'assets/sprites/items/blazikenite.png', true, false),
(1018, 'Gardevoirite', 'mega_stone', NULL, 'mega_gardevoir', 0, 'Mega-evolui Gardevoir.', 0, 'assets/sprites/items/gardevoirite.png', true, false),
(1019, 'Mawhite', 'mega_stone', NULL, 'mega_mawile', 0, 'Mega-evolui Mawile.', 0, 'assets/sprites/items/mawilite.png', true, false),
(1020, 'Aggronite', 'mega_stone', NULL, 'mega_aggron', 0, 'Mega-evolui Aggron.', 0, 'assets/sprites/items/aggronite.png', true, false),
(1021, 'Manectite', 'mega_stone', NULL, 'mega_manectric', 0, 'Mega-evolui Manectric.', 0, 'assets/sprites/items/manectite.png', true, false),
(1022, 'Garchompite', 'mega_stone', NULL, 'mega_garchomp', 0, 'Mega-evolui Garchomp.', 0, 'assets/sprites/items/garchompite.png', true, false),
(1023, 'Lucarionite', 'mega_stone', NULL, 'mega_lucario', 0, 'Mega-evolui Lucario.', 0, 'assets/sprites/items/lucarionite.png', true, false),
(1024, 'Abomasite', 'mega_stone', NULL, 'mega_abomasnow', 0, 'Mega-evolui Abomasnow.', 0, 'assets/sprites/items/abomasite.png', true, false),
(1025, 'Beedrillite', 'mega_stone', NULL, 'mega_beedrill', 0, 'Mega-evolui Beedrill.', 0, 'assets/sprites/items/beedrillite.png', true, false),
(1026, 'Pidgeotite', 'mega_stone', NULL, 'mega_pidgeot', 0, 'Mega-evolui Pidgeot.', 0, 'assets/sprites/items/pidgeotite.png', true, false),
(1027, 'Slowbronite', 'mega_stone', NULL, 'mega_slowbro', 0, 'Mega-evolui Slowbro.', 0, 'assets/sprites/items/slowbronite.png', true, false),
(1028, 'Steelixite', 'mega_stone', NULL, 'mega_steelix', 0, 'Mega-evolui Steelix.', 0, 'assets/sprites/items/steelixite.png', true, false),
(1029, 'Sharpedonite', 'mega_stone', NULL, 'mega_sharpedo', 0, 'Mega-evolui Sharpedo.', 0, 'assets/sprites/items/sharpedonite.png', true, false),
(1030, 'Cameruptite', 'mega_stone', NULL, 'mega_camerupt', 0, 'Mega-evolui Camerupt.', 0, 'assets/sprites/items/cameruptite.png', true, false),
(1031, 'Altarianite', 'mega_stone', NULL, 'mega_altaria', 0, 'Mega-evolui Altaria.', 0, 'assets/sprites/items/altarianite.png', true, false),
(1032, 'Salamencite', 'mega_stone', NULL, 'mega_salamence', 0, 'Mega-evolui Salamence.', 0, 'assets/sprites/items/salamencite.png', true, false),
(1033, 'Metagrossite', 'mega_stone', NULL, 'mega_metagross', 0, 'Mega-evolui Metagross.', 0, 'assets/sprites/items/metagrossite.png', true, false),
(1034, 'Latiasite', 'mega_stone', NULL, 'mega_latias', 0, 'Mega-evolui Latias.', 0, 'assets/sprites/items/latiasite.png', true, false),
(1035, 'Latiosite', 'mega_stone', NULL, 'mega_latios', 0, 'Mega-evolui Latios.', 0, 'assets/sprites/items/latiosite.png', true, false),
(1036, 'Rayquazite', 'mega_stone', NULL, 'mega_rayquaza', 0, 'Mega-evolui Rayquaza.', 0, 'assets/sprites/items/rayquazite.png', true, false),
(1037, 'Lopunnite', 'mega_stone', NULL, 'mega_lopunny', 0, 'Mega-evolui Lopunny.', 0, 'assets/sprites/items/lopunnite.png', true, false),
(1038, 'Galladite', 'mega_stone', NULL, 'mega_gallade', 0, 'Mega-evolui Gallade.', 0, 'assets/sprites/items/galladite.png', true, false),
(1039, 'Audinite', 'mega_stone', NULL, 'mega_audino', 0, 'Mega-evolui Audino.', 0, 'assets/sprites/items/audinite.png', true, false),
(1040, 'Diancite', 'mega_stone', NULL, 'mega_diancie', 0, 'Mega-evolui Diancie.', 0, 'assets/sprites/items/diancite.png', true, false),
(1041, 'Sceptilite', 'mega_stone', NULL, 'mega_sceptile', 0, 'Mega-evolui Sceptile.', 0, 'assets/sprites/items/sceptilite.png', true, false),
(1042, 'Swampertite', 'mega_stone', NULL, 'mega_swampert', 0, 'Mega-evolui Swampert.', 0, 'assets/sprites/items/swampertite.png', true, false),
(1043, 'Banettite', 'mega_stone', NULL, 'mega_banette', 0, 'Mega-evolui Banette.', 0, 'assets/sprites/items/banettite.png', true, false),
(1044, 'Absolite', 'mega_stone', NULL, 'mega_absol', 0, 'Mega-evolui Absol.', 0, 'assets/sprites/items/absolite.png', true, false),
(1045, 'Sableyenite', 'mega_stone', NULL, 'mega_sableye', 0, 'Mega-evolui Sableye.', 0, 'assets/sprites/items/sableyenite.png', true, false),
(1046, 'Glalitite', 'mega_stone', NULL, 'mega_glalie', 0, 'Mega-evolui Glalie.', 0, 'assets/sprites/items/glalitite.png', true, false)

ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    category = EXCLUDED.category,
    subcategory = EXCLUDED.subcategory,
    effect = EXCLUDED.effect,
    effect_value = EXCLUDED.effect_value,
    description = EXCLUDED.description,
    price = EXCLUDED.price,
    sprite_url = EXCLUDED.sprite_url,
    holdable = EXCLUDED.holdable,
    usable_in_battle = EXCLUDED.usable_in_battle;

-- 5. Garantir FK entre player_inventory.item_id e items.id
-- Primeiro remover constraint antiga se existir
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'player_inventory'::regclass
        AND confrelid = 'items'::regclass
    ) THEN
        ALTER TABLE player_inventory DROP CONSTRAINT IF EXISTS player_inventory_item_id_fkey;
    END IF;
END $$;

ALTER TABLE player_inventory
    ADD CONSTRAINT player_inventory_item_id_fkey
    FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE;

-- 6. Garantir RLS da tabela items (leitura publica)
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "items_select" ON items;
CREATE POLICY "items_select" ON items FOR SELECT USING (true);

-- 7. Verificacao
SELECT 'Items total: ' || count(*)::text FROM items;
SELECT 'Inventory rows: ' || count(*)::text FROM player_inventory;
