-- ============================================================
-- SPAWN ZONES: garantia da coluna biome
-- Run this ONCE in Supabase SQL Editor (ou junto com o arquivo principal)
-- ============================================================

-- Remove a coluna antiga (region_map_id) se existir no schema
ALTER TABLE city_spawn_zones DROP COLUMN IF EXISTS region_map_id;

-- Garante a coluna biome
ALTER TABLE city_spawn_zones ADD COLUMN IF NOT EXISTS biome TEXT;
