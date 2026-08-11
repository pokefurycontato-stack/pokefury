-- Add experience column to pokemon_team
ALTER TABLE pokemon_team ADD COLUMN IF NOT EXISTS experience INTEGER DEFAULT 0;
