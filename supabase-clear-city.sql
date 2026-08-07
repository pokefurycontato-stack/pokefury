CREATE OR REPLACE FUNCTION clear_city_layout()
RETURNS void AS $$
BEGIN
    DELETE FROM city_layout;
    DELETE FROM city_collision_zones;
    DELETE FROM city_teleports;
    DELETE FROM city_npcs;
    DELETE FROM city_battle_zones;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
