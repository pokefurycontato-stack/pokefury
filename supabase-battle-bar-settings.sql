-- PokeFury - Posição global das barras de vida da batalha (jogador + inimigo)
-- As barras usam porcentagem da tela, então ficam no MESMO lugar em qualquer monitor.
-- Rode no SQL Editor do Supabase (logado como admin).

CREATE TABLE IF NOT EXISTS battle_bar_settings (
    id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    player_left NUMERIC NOT NULL DEFAULT 0.06,
    player_bottom NUMERIC NOT NULL DEFAULT 0.06,
    enemy_right NUMERIC NOT NULL DEFAULT 0.06,
    enemy_top NUMERIC NOT NULL DEFAULT 0.49,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE battle_bar_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "battle_bar_settings_read" ON battle_bar_settings;
CREATE POLICY "battle_bar_settings_read" ON battle_bar_settings
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "battle_bar_settings_admin_write" ON battle_bar_settings;
CREATE POLICY "battle_bar_settings_admin_write" ON battle_bar_settings
    FOR ALL USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
    ) WITH CHECK (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
    );

INSERT INTO battle_bar_settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;