-- Update gym leader sprite_url (Galar + Hisui + Paldea)
-- Padrão: sprites/gym-leaders/{Nome}.png (upload dos sprites no bucket)

-- Faltantes do meio (Hoenn / Kalos)
UPDATE gym_leaders SET sprite_url = 'https://odevwnnpzsoltbrrjdts.supabase.co/storage/v1/object/public/sprites/gym-leaders/Tate_and_Liza.png' WHERE name = 'Tate and Liza';
UPDATE gym_leaders SET sprite_url = 'https://odevwnnpzsoltbrrjdts.supabase.co/storage/v1/object/public/sprites/gym-leaders/Grant.png' WHERE name = 'Grant';

-- GALAR
UPDATE gym_leaders SET sprite_url = 'https://odevwnnpzsoltbrrjdts.supabase.co/storage/v1/object/public/sprites/gym-leaders/Milo.png' WHERE name = 'Milo';
UPDATE gym_leaders SET sprite_url = 'https://odevwnnpzsoltbrrjdts.supabase.co/storage/v1/object/public/sprites/gym-leaders/Nessa.png' WHERE name = 'Nessa';
UPDATE gym_leaders SET sprite_url = 'https://odevwnnpzsoltbrrjdts.supabase.co/storage/v1/object/public/sprites/gym-leaders/Kabu.png' WHERE name = 'Kabu';
UPDATE gym_leaders SET sprite_url = 'https://odevwnnpzsoltbrrjdts.supabase.co/storage/v1/object/public/sprites/gym-leaders/Bea.png' WHERE name = 'Bea';
UPDATE gym_leaders SET sprite_url = 'https://odevwnnpzsoltbrrjdts.supabase.co/storage/v1/object/public/sprites/gym-leaders/Opal.png' WHERE name = 'Opal';
UPDATE gym_leaders SET sprite_url = 'https://odevwnnpzsoltbrrjdts.supabase.co/storage/v1/object/public/sprites/gym-leaders/Gordie.png' WHERE name = 'Gordie';
UPDATE gym_leaders SET sprite_url = 'https://odevwnnpzsoltbrrjdts.supabase.co/storage/v1/object/public/sprites/gym-leaders/Piers.png' WHERE name = 'Piers';
UPDATE gym_leaders SET sprite_url = 'https://odevwnnpzsoltbrrjdts.supabase.co/storage/v1/object/public/sprites/gym-leaders/Raihan.png' WHERE name = 'Raihan';

-- HISUI
UPDATE gym_leaders SET sprite_url = 'https://odevwnnpzsoltbrrjdts.supabase.co/storage/v1/object/public/sprites/gym-leaders/Lian.png' WHERE name = 'Lian';
UPDATE gym_leaders SET sprite_url = 'https://odevwnnpzsoltbrrjdts.supabase.co/storage/v1/object/public/sprites/gym-leaders/Calaba.png' WHERE name = 'Calaba';
UPDATE gym_leaders SET sprite_url = 'https://odevwnnpzsoltbrrjdts.supabase.co/storage/v1/object/public/sprites/gym-leaders/Ingo.png' WHERE name = 'Ingo';
UPDATE gym_leaders SET sprite_url = 'https://odevwnnpzsoltbrrjdts.supabase.co/storage/v1/object/public/sprites/gym-leaders/Adaman.png' WHERE name = 'Adaman';
UPDATE gym_leaders SET sprite_url = 'https://odevwnnpzsoltbrrjdts.supabase.co/storage/v1/object/public/sprites/gym-leaders/Iridium.png' WHERE name = 'Iridium';
UPDATE gym_leaders SET sprite_url = 'https://odevwnnpzsoltbrrjdts.supabase.co/storage/v1/object/public/sprites/gym-leaders/Kamado.png' WHERE name = 'Kamado';

-- PALDEA
UPDATE gym_leaders SET sprite_url = 'https://odevwnnpzsoltbrrjdts.supabase.co/storage/v1/object/public/sprites/gym-leaders/Katy.png' WHERE name = 'Katy';
UPDATE gym_leaders SET sprite_url = 'https://odevwnnpzsoltbrrjdts.supabase.co/storage/v1/object/public/sprites/gym-leaders/Brassius.png' WHERE name = 'Brassius';
UPDATE gym_leaders SET sprite_url = 'https://odevwnnpzsoltbrrjdts.supabase.co/storage/v1/object/public/sprites/gym-leaders/Iono.png' WHERE name = 'Iono';
UPDATE gym_leaders SET sprite_url = 'https://odevwnnpzsoltbrrjdts.supabase.co/storage/v1/object/public/sprites/gym-leaders/Kofu.png' WHERE name = 'Kofu';
UPDATE gym_leaders SET sprite_url = 'https://odevwnnpzsoltbrrjdts.supabase.co/storage/v1/object/public/sprites/gym-leaders/Larry.png' WHERE name = 'Larry';
UPDATE gym_leaders SET sprite_url = 'https://odevwnnpzsoltbrrjdts.supabase.co/storage/v1/object/public/sprites/gym-leaders/Ryme.png' WHERE name = 'Ryme';
UPDATE gym_leaders SET sprite_url = 'https://odevwnnpzsoltbrrjdts.supabase.co/storage/v1/object/public/sprites/gym-leaders/Tulip.png' WHERE name = 'Tulip';
UPDATE gym_leaders SET sprite_url = 'https://odevwnnpzsoltbrrjdts.supabase.co/storage/v1/object/public/sprites/gym-leaders/Grusha.png' WHERE name = 'Grusha';
