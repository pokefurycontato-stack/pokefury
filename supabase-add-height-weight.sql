-- Add height and weight columns to pokemon table for sprite scaling
ALTER TABLE pokemon ADD COLUMN IF NOT EXISTS height INTEGER DEFAULT 10;
ALTER TABLE pokemon ADD COLUMN IF NOT EXISTS weight INTEGER DEFAULT 100;
