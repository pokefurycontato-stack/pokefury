CREATE TABLE IF NOT EXISTS battle_position_settings (
    background_url TEXT PRIMARY KEY,
    player_x NUMERIC NOT NULL DEFAULT 0.25,
    player_y NUMERIC NOT NULL DEFAULT 0.75,
    enemy_x NUMERIC NOT NULL DEFAULT 0.72,
    enemy_y NUMERIC NOT NULL DEFAULT 0.40,
    player_fx TEXT NOT NULL DEFAULT 'none',
    enemy_fx TEXT NOT NULL DEFAULT 'none',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE battle_position_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "battle_positions_read" ON battle_position_settings;
CREATE POLICY "battle_positions_read" ON battle_position_settings
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "battle_positions_admin_write" ON battle_position_settings;
CREATE POLICY "battle_positions_admin_write" ON battle_position_settings
    FOR ALL USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
    ) WITH CHECK (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
    );
