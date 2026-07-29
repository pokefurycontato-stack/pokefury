-- =============================================
-- POKEFURY: MEGA FIX - Run this ONE SQL file
-- Supabase Dashboard > SQL Editor
-- =============================================

-- 1. Ensure variant columns exist
ALTER TABLE pokemon ADD COLUMN IF NOT EXISTS variant TEXT DEFAULT 'normal';
ALTER TABLE pokemon ADD COLUMN IF NOT EXISTS base_pokemon_id INTEGER;
CREATE INDEX IF NOT EXISTS idx_pokemon_variant ON pokemon(variant);
CREATE INDEX IF NOT EXISTS idx_pokemon_base ON pokemon(base_pokemon_id);

-- 2. Drop ALL existing pokemon policies (clean slate)
DO $$ BEGIN
    DROP POLICY IF EXISTS "pokemon_select" ON pokemon;
    DROP POLICY IF EXISTS "pokemon_insert" ON pokemon;
    DROP POLICY IF EXISTS "pokemon_update" ON pokemon;
    DROP POLICY IF EXISTS "pokemon_delete" ON pokemon;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 3. Recreate permissive policies
CREATE POLICY "pokemon_select" ON pokemon FOR SELECT USING (true);
CREATE POLICY "pokemon_insert" ON pokemon FOR INSERT WITH CHECK (true);
CREATE POLICY "pokemon_update" ON pokemon FOR UPDATE USING (true);

-- 4. Insert all variants (ON CONFLICT DO NOTHING = safe to re-run)
INSERT INTO pokemon (id, name, types, hp, attack, defense, sp_atk, sp_def, speed, variant, base_pokemon_id)
VALUES
(10001, 'Venusaur (Mega)', '{"grass","poison"}', 80, 100, 123, 122, 120, 80, 'mega', 3),
(10002, 'Charizard (Mega X)', '{"fire","dragon"}', 78, 130, 111, 130, 85, 100, 'mega', 6),
(10003, 'Charizard (Mega Y)', '{"fire","flying"}', 78, 130, 111, 159, 85, 100, 'mega', 6),
(10004, 'Blastoise (Mega)', '{"water"}', 79, 103, 120, 135, 115, 78, 'mega', 9),
(10005, 'Alakazam (Mega)', '{"psychic"}', 55, 50, 65, 175, 95, 150, 'mega', 65),
(10006, 'Gengar (Mega)', '{"ghost","poison"}', 60, 65, 60, 130, 75, 110, 'mega', 94),
(10007, 'Kangaskhan (Mega)', '{"normal"}', 105, 125, 100, 60, 100, 100, 'mega', 115),
(10008, 'Pinsir (Mega)', '{"bug","flying"}', 65, 155, 120, 65, 90, 105, 'mega', 127),
(10009, 'Gyarados (Mega)', '{"water","dark"}', 95, 125, 109, 70, 130, 81, 'mega', 130),
(10010, 'Aerodactyl (Mega)', '{"rock","flying"}', 80, 135, 85, 60, 75, 150, 'mega', 142),
(10011, 'Mewtwo (Mega X)', '{"psychic","fighting"}', 106, 150, 70, 194, 120, 130, 'mega', 150),
(10012, 'Mewtwo (Mega Y)', '{"psychic"}', 106, 150, 70, 194, 120, 130, 'mega', 150),
(10013, 'Scizor (Mega)', '{"bug","steel"}', 70, 150, 140, 65, 100, 75, 'mega', 212),
(10014, 'Heracross (Mega)', '{"bug","fighting"}', 80, 185, 115, 40, 105, 75, 'mega', 214),
(10015, 'Houndoom (Mega)', '{"dark","fire"}', 75, 90, 90, 140, 90, 115, 'mega', 229),
(10016, 'Tyranitar (Mega)', '{"rock","dark"}', 100, 134, 131, 95, 110, 71, 'mega', 248),
(10017, 'Blaziken (Mega)', '{"fire","fighting"}', 80, 160, 80, 130, 80, 100, 'mega', 257),
(10018, 'Gardevoir (Mega)', '{"psychic","fairy"}', 68, 85, 65, 165, 135, 100, 'mega', 282),
(10019, 'Mawile (Mega)', '{"steel","fairy"}', 50, 105, 125, 55, 95, 50, 'mega', 303),
(10020, 'Aggron (Mega)', '{"steel"}', 70, 140, 230, 60, 80, 50, 'mega', 306),
(10021, 'Manectric (Mega)', '{"electric"}', 70, 75, 80, 135, 80, 135, 'mega', 310),
(10022, 'Garchomp (Mega)', '{"dragon","ground"}', 108, 170, 115, 120, 95, 92, 'mega', 445),
(10023, 'Lucario (Mega)', '{"fighting","steel"}', 70, 145, 88, 140, 70, 112, 'mega', 448),
(10024, 'Abomasnow (Mega)', '{"grass","ice"}', 90, 132, 105, 132, 105, 30, 'mega', 460),
(10025, 'Beedrill (Mega)', '{"bug","poison"}', 65, 150, 40, 15, 80, 145, 'mega', 15),
(10026, 'Pidgeot (Mega)', '{"normal","flying"}', 83, 80, 80, 135, 80, 121, 'mega', 18),
(10027, 'Slowbro (Mega)', '{"water","psychic"}', 95, 75, 180, 130, 80, 30, 'mega', 80),
(10028, 'Steelix (Mega)', '{"steel","ground"}', 75, 85, 205, 55, 65, 30, 'mega', 208),
(10029, 'Sharpedo (Mega)', '{"water","dark"}', 70, 140, 70, 110, 65, 105, 'mega', 319),
(10030, 'Camerupt (Mega)', '{"fire","ground"}', 70, 120, 100, 145, 105, 20, 'mega', 323),
(10031, 'Altaria (Mega)', '{"dragon","fairy"}', 75, 110, 110, 110, 105, 80, 'mega', 334),
(10032, 'Salamence (Mega)', '{"dragon","flying"}', 95, 145, 130, 120, 90, 120, 'mega', 373),
(10033, 'Metagross (Mega)', '{"steel","psychic"}', 80, 145, 150, 105, 110, 110, 'mega', 376),
(10034, 'Latias (Mega)', '{"dragon","psychic"}', 80, 100, 120, 140, 150, 110, 'mega', 380),
(10035, 'Latios (Mega)', '{"dragon","psychic"}', 80, 130, 100, 160, 120, 110, 'mega', 381),
(10036, 'Rayquaza (Mega)', '{"dragon","flying"}', 105, 180, 100, 180, 100, 115, 'mega', 384),
(10037, 'Lopunny (Mega)', '{"normal","fighting"}', 65, 136, 94, 54, 96, 135, 'mega', 428),
(10038, 'Gallade (Mega)', '{"psychic","fighting"}', 68, 165, 95, 65, 115, 110, 'mega', 475),
(10039, 'Audino (Mega)', '{"normal","fairy"}', 103, 60, 126, 80, 126, 50, 'mega', 531),
(10040, 'Diancie (Mega)', '{"rock","fairy"}', 50, 100, 110, 100, 110, 110, 'mega', 719),
(10041, 'Sceptile (Mega)', '{"grass","dragon"}', 70, 110, 75, 145, 85, 145, 'mega', 254),
(10042, 'Swampert (Mega)', '{"water","ground"}', 100, 150, 110, 95, 110, 70, 'mega', 260),
(10043, 'Banette (Mega)', '{"ghost"}', 64, 165, 75, 93, 83, 75, 'mega', 354),
(10044, 'Absol (Mega)', '{"dark"}', 65, 150, 60, 115, 60, 115, 'mega', 359),
(10045, 'Sableye (Mega)', '{"dark","ghost"}', 50, 65, 115, 55, 115, 20, 'mega', 302),
(10046, 'Glalie (Mega)', '{"ice"}', 80, 120, 80, 120, 80, 100, 'mega', 362),
(11001, 'Charizard (G-Max)', '{"fire","flying"}', 78, 84, 78, 109, 85, 100, 'gmax', 6),
(11002, 'Butterfree (G-Max)', '{"bug","flying"}', 60, 45, 50, 90, 80, 70, 'gmax', 12),
(11003, 'Pikachu (G-Max)', '{"electric"}', 35, 55, 40, 50, 50, 90, 'gmax', 25),
(11004, 'Meowth (G-Max)', '{"normal"}', 40, 45, 35, 40, 40, 90, 'gmax', 52),
(11005, 'Machamp (G-Max)', '{"fighting"}', 90, 130, 80, 65, 85, 55, 'gmax', 68),
(11006, 'Gengar (G-Max)', '{"ghost","poison"}', 60, 65, 60, 130, 75, 110, 'gmax', 94),
(11007, 'Kingler (G-Max)', '{"water"}', 55, 130, 115, 50, 50, 75, 'gmax', 99),
(11008, 'Lapras (G-Max)', '{"water","ice"}', 130, 85, 80, 85, 95, 60, 'gmax', 131),
(11009, 'Eevee (G-Max)', '{"normal"}', 55, 55, 50, 45, 65, 55, 'gmax', 133),
(11010, 'Snorlax (G-Max)', '{"normal"}', 160, 110, 65, 65, 110, 30, 'gmax', 143),
(11011, 'Garbodor (G-Max)', '{"poison"}', 80, 95, 82, 60, 82, 75, 'gmax', 569),
(11012, 'Melmetal (G-Max)', '{"steel"}', 135, 143, 143, 80, 65, 34, 'gmax', 809),
(11013, 'Corviknight (G-Max)', '{"flying","steel"}', 98, 87, 105, 53, 85, 67, 'gmax', 823),
(11014, 'Orbeetle (G-Max)', '{"bug","psychic"}', 60, 45, 110, 80, 120, 90, 'gmax', 826),
(11015, 'Drednaw (G-Max)', '{"water","rock"}', 115, 115, 115, 48, 68, 74, 'gmax', 834),
(11016, 'Coalossal (G-Max)', '{"rock","fire"}', 110, 80, 120, 80, 90, 30, 'gmax', 839),
(11017, 'Flapple (G-Max)', '{"grass","dragon"}', 70, 110, 80, 95, 85, 70, 'gmax', 841),
(11018, 'Appletun (G-Max)', '{"grass","dragon"}', 86, 80, 100, 80, 100, 30, 'gmax', 842),
(11021, 'Centiskorch (G-Max)', '{"fire","bug"}', 100, 115, 65, 90, 90, 65, 'gmax', 849),
(11022, 'Hatterene (G-Max)', '{"psychic","fairy"}', 57, 90, 95, 136, 103, 29, 'gmax', 858),
(11023, 'Grimmsnarl (G-Max)', '{"dark","fairy"}', 95, 125, 65, 95, 75, 60, 'gmax', 861),
(11024, 'Alcremie (G-Max)', '{"fairy"}', 65, 60, 75, 110, 121, 64, 'gmax', 868),
(11025, 'Copperajah (G-Max)', '{"steel"}', 125, 130, 100, 50, 68, 30, 'gmax', 879),
(11026, 'Duraludon (G-Max)', '{"steel","dragon"}', 95, 115, 125, 100, 50, 85, 'gmax', 884),
(12001, 'Vulpix (Alola)', '{"ice"}', 38, 41, 40, 50, 65, 65, 'alola', 37),
(12002, 'Ninetales (Alola)', '{"ice","fairy"}', 73, 67, 75, 81, 100, 109, 'alola', 38),
(12003, 'Sandshrew (Alola)', '{"ice","steel"}', 50, 75, 90, 10, 35, 40, 'alola', 27),
(12004, 'Sandslash (Alola)', '{"ice","steel"}', 75, 100, 120, 25, 45, 65, 'alola', 28),
(12005, 'Raichu (Alola)', '{"electric","psychic"}', 60, 85, 50, 95, 85, 110, 'alola', 26),
(12006, 'Geodude (Alola)', '{"rock","electric"}', 40, 80, 100, 30, 45, 20, 'alola', 74),
(12007, 'Graveler (Alola)', '{"rock","electric"}', 55, 95, 115, 40, 45, 35, 'alola', 75),
(12008, 'Golem (Alola)', '{"rock","electric"}', 80, 120, 130, 50, 65, 45, 'alola', 76),
(12009, 'Grimer (Alola)', '{"poison","dark"}', 80, 80, 50, 40, 50, 25, 'alola', 88),
(12010, 'Muk (Alola)', '{"poison","dark"}', 105, 105, 75, 65, 100, 50, 'alola', 89),
(12011, 'Exeggutor (Alola)', '{"grass","dragon"}', 95, 105, 85, 125, 75, 45, 'alola', 103),
(12012, 'Marowak (Alola)', '{"fire","ghost"}', 60, 80, 110, 50, 100, 45, 'alola', 105),
(12013, 'Ponyta (Galar)', '{"psychic"}', 50, 85, 55, 65, 65, 90, 'galar', 77),
(12014, 'Rapidash (Galar)', '{"psychic","fairy"}', 65, 100, 70, 80, 80, 105, 'galar', 78),
(12015, 'Slowpoke (Galar)', '{"psychic"}', 90, 65, 65, 40, 40, 15, 'galar', 79),
(12016, 'Slowbro (Galar)', '{"poison","psychic"}', 95, 100, 95, 100, 70, 30, 'galar', 80),
(12017, 'Weezing (Galar)', '{"poison","fairy"}', 65, 90, 120, 85, 90, 60, 'galar', 110),
(12018, 'Mr. Mime (Galar)', '{"ice","psychic"}', 50, 65, 65, 90, 90, 100, 'galar', 122),
(12019, 'Corsola (Galar)', '{"ghost"}', 60, 55, 100, 65, 100, 30, 'galar', 222),
(12020, 'Zigzagoon (Galar)', '{"dark","normal"}', 38, 30, 41, 30, 41, 60, 'galar', 263),
(12021, 'Linoone (Galar)', '{"dark","normal"}', 78, 70, 61, 50, 61, 100, 'galar', 264),
(12022, 'Darumaka (Galar)', '{"ice"}', 70, 90, 45, 15, 45, 50, 'galar', 554),
(12024, 'Yamask (Galar)', '{"ground","ghost"}', 38, 55, 85, 30, 65, 30, 'galar', 562),
(12025, 'Stunfisk (Galar)', '{"ground","steel"}', 109, 81, 99, 66, 84, 32, 'galar', 618),
(12026, 'Growlithe (Hisui)', '{"fire","rock"}', 60, 75, 45, 65, 45, 55, 'hisui', 58),
(12027, 'Arcanine (Hisui)', '{"fire","rock"}', 95, 115, 80, 95, 80, 90, 'hisui', 59),
(12028, 'Voltorb (Hisui)', '{"electric","grass"}', 40, 30, 50, 55, 55, 100, 'hisui', 100),
(12029, 'Electrode (Hisui)', '{"electric","grass"}', 60, 50, 70, 80, 80, 150, 'hisui', 101),
(12030, 'Typhlosion (Hisui)', '{"fire","ghost"}', 78, 84, 78, 119, 85, 95, 'hisui', 157),
(12031, 'Qwilfish (Hisui)', '{"dark","poison"}', 65, 95, 85, 55, 55, 85, 'hisui', 211),
(12032, 'Sneasel (Hisui)', '{"fighting","poison"}', 55, 95, 55, 35, 75, 115, 'hisui', 215),
(12033, 'Sliggoo (Hisui)', '{"steel","dragon"}', 90, 100, 125, 105, 85, 40, 'hisui', 705),
(12034, 'Goodra (Hisui)', '{"steel","dragon"}', 100, 110, 130, 100, 85, 70, 'hisui', 706),
(12035, 'Avalugg (Hisui)', '{"ice","rock"}', 117, 131, 184, 34, 36, 38, 'hisui', 713),
(12036, 'Braviary (Hisui)', '{"psychic","flying"}', 110, 83, 70, 112, 70, 65, 'hisui', 628),
(12037, 'Wooper (Paldea)', '{"poison","ground"}', 55, 45, 45, 25, 25, 15, 'paldea', 194)
ON CONFLICT (id) DO NOTHING;

-- 5. Reload PostgREST schema cache (IMPORTANT!)
NOTIFY pgrst, 'reload schema';

-- 6. Verify: should return 106 rows
SELECT count(*) AS total_variants FROM pokemon WHERE variant != 'normal';
