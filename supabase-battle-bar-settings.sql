-- PokeFury - Posição das barras de vida da batalha POR FUNDO (jogador + inimigo)
-- As barras usam porcentagem da tela, então ficam no MESMO lugar em qualquer monitor.
-- Rode no SQL Editor do Supabase (logado como admin).
-- OBS: recria a tabela. Se já rodou a versão anterior (id único), ela será recriada sem dados.

DROP TABLE IF EXISTS battle_bar_settings;

CREATE TABLE battle_bar_settings (
    background_url TEXT PRIMARY KEY,
    player_left NUMERIC NOT NULL DEFAULT 0.06,
    player_bottom NUMERIC NOT NULL DEFAULT 0.06,
    enemy_right NUMERIC NOT NULL DEFAULT 0.06,
    enemy_top NUMERIC NOT NULL DEFAULT 0.49,
    box_opacity NUMERIC NOT NULL DEFAULT 0.85,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Compatibilidade: se a tabela ja existia sem a coluna de opacidade, adiciona agora.
ALTER TABLE battle_bar_settings ADD COLUMN IF NOT EXISTS box_opacity NUMERIC NOT NULL DEFAULT 0.85;

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