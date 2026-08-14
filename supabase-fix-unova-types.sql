-- Fix Unova gym leader types (estavam todos como 'Normal')

UPDATE gym_leaders SET type='Grass', badge_name='Trio Badge' WHERE name='Cilan';
UPDATE gym_leaders SET type='Normal', badge_name='Basic Badge' WHERE name='Lenora';
UPDATE gym_leaders SET type='Bug', badge_name='Insect Badge' WHERE name='Burgh';
UPDATE gym_leaders SET type='Electric', badge_name='Bolt Badge' WHERE name='Elesa';
UPDATE gym_leaders SET type='Ground', badge_name='Quake Badge' WHERE name='Clay';
UPDATE gym_leaders SET type='Flying', badge_name='Jet Badge' WHERE name='Skyla';
UPDATE gym_leaders SET type='Ice', badge_name='Freeze Badge' WHERE name='Brycen';
UPDATE gym_leaders SET type='Dragon', badge_name='Legend Badge' WHERE name='Drayden';
