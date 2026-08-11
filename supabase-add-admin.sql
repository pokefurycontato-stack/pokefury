-- Add is_admin to profiles and set your account as admin
-- Run in Supabase SQL Editor

DO $$ BEGIN
    ALTER TABLE profiles ADD COLUMN is_admin BOOLEAN DEFAULT false;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

UPDATE profiles SET is_admin = true WHERE id = 'b405808e-2fc3-4fa9-8b31-ebe7883223bf';
