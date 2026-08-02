-- ============================================================
-- ADICIONAR COLUNA required_leader_id
-- Permite definir qual líder precisa ser derrotado antes
-- ============================================================

-- Adicionar coluna required_leader_id (cada ginásio depende do anterior)
DO $$ BEGIN
    ALTER TABLE gym_leaders ADD COLUMN required_leader_id UUID REFERENCES gym_leaders(id);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Definir pré-requisitos (cada ginásio precisa do anterior)
-- Kanto
UPDATE gym_leaders SET required_leader_id = (SELECT id FROM gym_leaders WHERE name='Brock' LIMIT 1) WHERE name='Misty';
UPDATE gym_leaders SET required_leader_id = (SELECT id FROM gym_leaders WHERE name='Misty' LIMIT 1) WHERE name='Lt. Surge';
UPDATE gym_leaders SET required_leader_id = (SELECT id FROM gym_leaders WHERE name='Lt. Surge' LIMIT 1) WHERE name='Erika';
UPDATE gym_leaders SET required_leader_id = (SELECT id FROM gym_leaders WHERE name='Erika' LIMIT 1) WHERE name='Koga';
UPDATE gym_leaders SET required_leader_id = (SELECT id FROM gym_leaders WHERE name='Koga' LIMIT 1) WHERE name='Sabrina';
UPDATE gym_leaders SET required_leader_id = (SELECT id FROM gym_leaders WHERE name='Sabrina' LIMIT 1) WHERE name='Blaine';
UPDATE gym_leaders SET required_leader_id = (SELECT id FROM gym_leaders WHERE name='Blaine' LIMIT 1) WHERE name='Giovanni';

-- Johto
UPDATE gym_leaders SET required_leader_id = (SELECT id FROM gym_leaders WHERE name='Falkner' LIMIT 1) WHERE name='Bugsy';
UPDATE gym_leaders SET required_leader_id = (SELECT id FROM gym_leaders WHERE name='Bugsy' LIMIT 1) WHERE name='Whitney';
UPDATE gym_leaders SET required_leader_id = (SELECT id FROM gym_leaders WHERE name='Whitney' LIMIT 1) WHERE name='Morty';
UPDATE gym_leaders SET required_leader_id = (SELECT id FROM gym_leaders WHERE name='Morty' LIMIT 1) WHERE name='Chuck';
UPDATE gym_leaders SET required_leader_id = (SELECT id FROM gym_leaders WHERE name='Chuck' LIMIT 1) WHERE name='Jasmine';
UPDATE gym_leaders SET required_leader_id = (SELECT id FROM gym_leaders WHERE name='Jasmine' LIMIT 1) WHERE name='Pryce';
UPDATE gym_leaders SET required_leader_id = (SELECT id FROM gym_leaders WHERE name='Pryce' LIMIT 1) WHERE name='Clair';

-- Hoenn
UPDATE gym_leaders SET required_leader_id = (SELECT id FROM gym_leaders WHERE name='Roxanne' LIMIT 1) WHERE name='Brawly';
UPDATE gym_leaders SET required_leader_id = (SELECT id FROM gym_leaders WHERE name='Brawly' LIMIT 1) WHERE name='Wattson';
UPDATE gym_leaders SET required_leader_id = (SELECT id FROM gym_leaders WHERE name='Wattson' LIMIT 1) WHERE name='Flannery';
UPDATE gym_leaders SET required_leader_id = (SELECT id FROM gym_leaders WHERE name='Flannery' LIMIT 1) WHERE name='Norman';
UPDATE gym_leaders SET required_leader_id = (SELECT id FROM gym_leaders WHERE name='Norman' LIMIT 1) WHERE name='Winona';
UPDATE gym_leaders SET required_leader_id = (SELECT id FROM gym_leaders WHERE name='Winona' LIMIT 1) WHERE name='Tate and Liza';
UPDATE gym_leaders SET required_leader_id = (SELECT id FROM gym_leaders WHERE name='Tate and Liza' LIMIT 1) WHERE name='Wallace';

-- Sinnoh
UPDATE gym_leaders SET required_leader_id = (SELECT id FROM gym_leaders WHERE name='Roark' LIMIT 1) WHERE name='Gardenia';
UPDATE gym_leaders SET required_leader_id = (SELECT id FROM gym_leaders WHERE name='Gardenia' LIMIT 1) WHERE name='Fantina';
UPDATE gym_leaders SET required_leader_id = (SELECT id FROM gym_leaders WHERE name='Fantina' LIMIT 1) WHERE name='Maylene';
UPDATE gym_leaders SET required_leader_id = (SELECT id FROM gym_leaders WHERE name='Maylene' LIMIT 1) WHERE name='Crasher Wake';
UPDATE gym_leaders SET required_leader_id = (SELECT id FROM gym_leaders WHERE name='Crasher Wake' LIMIT 1) WHERE name='Byron';
UPDATE gym_leaders SET required_leader_id = (SELECT id FROM gym_leaders WHERE name='Byron' LIMIT 1) WHERE name='Candice';
UPDATE gym_leaders SET required_leader_id = (SELECT id FROM gym_leaders WHERE name='Candice' LIMIT 1) WHERE name='Volkner';

-- Unova
UPDATE gym_leaders SET required_leader_id = (SELECT id FROM gym_leaders WHERE name='Cilan' LIMIT 1) WHERE name='Lenora';
UPDATE gym_leaders SET required_leader_id = (SELECT id FROM gym_leaders WHERE name='Lenora' LIMIT 1) WHERE name='Burgh';
UPDATE gym_leaders SET required_leader_id = (SELECT id FROM gym_leaders WHERE name='Burgh' LIMIT 1) WHERE name='Elesa';
UPDATE gym_leaders SET required_leader_id = (SELECT id FROM gym_leaders WHERE name='Elesa' LIMIT 1) WHERE name='Clay';
UPDATE gym_leaders SET required_leader_id = (SELECT id FROM gym_leaders WHERE name='Clay' LIMIT 1) WHERE name='Skyla';
UPDATE gym_leaders SET required_leader_id = (SELECT id FROM gym_leaders WHERE name='Skyla' LIMIT 1) WHERE name='Brycen';
UPDATE gym_leaders SET required_leader_id = (SELECT id FROM gym_leaders WHERE name='Brycen' LIMIT 1) WHERE name='Drayden';

-- Kalos
UPDATE gym_leaders SET required_leader_id = (SELECT id FROM gym_leaders WHERE name='Viola' LIMIT 1) WHERE name='Grant';
UPDATE gym_leaders SET required_leader_id = (SELECT id FROM gym_leaders WHERE name='Grant' LIMIT 1) WHERE name='Korrina';
UPDATE gym_leaders SET required_leader_id = (SELECT id FROM gym_leaders WHERE name='Korrina' LIMIT 1) WHERE name='Ramos';
UPDATE gym_leaders SET required_leader_id = (SELECT id FROM gym_leaders WHERE name='Ramos' LIMIT 1) WHERE name='Valerie';
UPDATE gym_leaders SET required_leader_id = (SELECT id FROM gym_leaders WHERE name='Valerie' LIMIT 1) WHERE name='Olympia';
UPDATE gym_leaders SET required_leader_id = (SELECT id FROM gym_leaders WHERE name='Olympia' LIMIT 1) WHERE name='Wulfric';

-- Alola
UPDATE gym_leaders SET required_leader_id = (SELECT id FROM gym_leaders WHERE name='Hala' LIMIT 1) WHERE name='Olivia';
UPDATE gym_leaders SET required_leader_id = (SELECT id FROM gym_leaders WHERE name='Olivia' LIMIT 1) WHERE name='Nanu';
UPDATE gym_leaders SET required_leader_id = (SELECT id FROM gym_leaders WHERE name='Nanu' LIMIT 1) WHERE name='Hapu';

-- Galar
UPDATE gym_leaders SET required_leader_id = (SELECT id FROM gym_leaders WHERE name='Milo' LIMIT 1) WHERE name='Nessa';
UPDATE gym_leaders SET required_leader_id = (SELECT id FROM gym_leaders WHERE name='Nessa' LIMIT 1) WHERE name='Kabu';
UPDATE gym_leaders SET required_leader_id = (SELECT id FROM gym_leaders WHERE name='Kabu' LIMIT 1) WHERE name='Bea';
UPDATE gym_leaders SET required_leader_id = (SELECT id FROM gym_leaders WHERE name='Bea' LIMIT 1) WHERE name='Opal';
UPDATE gym_leaders SET required_leader_id = (SELECT id FROM gym_leaders WHERE name='Opal' LIMIT 1) WHERE name='Gordie';
UPDATE gym_leaders SET required_leader_id = (SELECT id FROM gym_leaders WHERE name='Gordie' LIMIT 1) WHERE name='Piers';
UPDATE gym_leaders SET required_leader_id = (SELECT id FROM gym_leaders WHERE name='Piers' LIMIT 1) WHERE name='Raihan';

-- Hisui
UPDATE gym_leaders SET required_leader_id = (SELECT id FROM gym_leaders WHERE name='Lian' LIMIT 1) WHERE name='Calaba';
UPDATE gym_leaders SET required_leader_id = (SELECT id FROM gym_leaders WHERE name='Calaba' LIMIT 1) WHERE name='Ingo';
UPDATE gym_leaders SET required_leader_id = (SELECT id FROM gym_leaders WHERE name='Ingo' LIMIT 1) WHERE name='Adaman';
UPDATE gym_leaders SET required_leader_id = (SELECT id FROM gym_leaders WHERE name='Adaman' LIMIT 1) WHERE name='Iridium';
UPDATE gym_leaders SET required_leader_id = (SELECT id FROM gym_leaders WHERE name='Iridium' LIMIT 1) WHERE name='Kamado';

-- Paldea
UPDATE gym_leaders SET required_leader_id = (SELECT id FROM gym_leaders WHERE name='Katy' LIMIT 1) WHERE name='Brassius';
UPDATE gym_leaders SET required_leader_id = (SELECT id FROM gym_leaders WHERE name='Brassius' LIMIT 1) WHERE name='Iono';
UPDATE gym_leaders SET required_leader_id = (SELECT id FROM gym_leaders WHERE name='Iono' LIMIT 1) WHERE name='Kofu';
UPDATE gym_leaders SET required_leader_id = (SELECT id FROM gym_leaders WHERE name='Kofu' LIMIT 1) WHERE name='Larry';
UPDATE gym_leaders SET required_leader_id = (SELECT id FROM gym_leaders WHERE name='Larry' LIMIT 1) WHERE name='Ryme';
UPDATE gym_leaders SET required_leader_id = (SELECT id FROM gym_leaders WHERE name='Ryme' LIMIT 1) WHERE name='Tulip';
UPDATE gym_leaders SET required_leader_id = (SELECT id FROM gym_leaders WHERE name='Tulip' LIMIT 1) WHERE name='Grusha';
