-- ============================================================
-- RLS para as tabelas do Raid Boss (permitir escrita no builder)
-- ============================================================

ALTER TABLE city_raid_portal ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "city_raid_portal_all" ON city_raid_portal;
CREATE POLICY "city_raid_portal_all" ON city_raid_portal FOR ALL USING (true);

ALTER TABLE city_raid_spawn ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "city_raid_spawn_all" ON city_raid_spawn;
CREATE POLICY "city_raid_spawn_all" ON city_raid_spawn FOR ALL USING (true);

ALTER TABLE city_raid_zones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "city_raid_zones_all" ON city_raid_zones;
CREATE POLICY "city_raid_zones_all" ON city_raid_zones FOR ALL USING (true);
