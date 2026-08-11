CREATE TABLE IF NOT EXISTS pvp_position_settings (
    id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    player_x NUMERIC NOT NULL DEFAULT 0.25,
    player_y NUMERIC NOT NULL DEFAULT 0.75,
    enemy_x NUMERIC NOT NULL DEFAULT 0.72,
    enemy_y NUMERIC NOT NULL DEFAULT 0.40,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE pvp_position_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pvp_positions_read" ON pvp_position_settings;
CREATE POLICY "pvp_positions_read" ON pvp_position_settings
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "pvp_positions_admin_write" ON pvp_position_settings;
CREATE POLICY "pvp_positions_admin_write" ON pvp_position_settings
    FOR ALL USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
    ) WITH CHECK (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
    );

INSERT INTO pvp_position_settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;
