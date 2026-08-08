-- ============================================================
-- SPAWN ZONES: add biome column
-- Run this ONCE in Supabase SQL Editor
-- A zona de spawn agora usa um BIOMA (ex: Floresta, Praia, Vulcao...)
-- e os encontros sao resolvidos pelo bioma + regiao atual do treinador
-- ============================================================

ALTER TABLE city_spawn_zones
ADD COLUMN IF NOT EXISTS biome TEXT;

-- Renomear coluna antiga para manter compatibilidade (opcional)
-- ALTER TABLE city_spawn_zones RENAME COLUMN region_map_id TO region_map_id_old;
