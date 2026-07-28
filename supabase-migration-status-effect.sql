-- ============================================================
-- MIGRATION: Add status_effect column to pokemon_team table
-- Run this ONCE in Supabase SQL Editor
-- ============================================================

-- Add status_effect column to store burn, poison, paralysis, etc.
ALTER TABLE pokemon_team
ADD COLUMN IF NOT EXISTS status_effect TEXT DEFAULT NULL;
