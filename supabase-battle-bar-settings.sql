-- PokeFury - Configuração das barras de vida da batalha POR FUNDO
-- As barras agora ficam COLADAS ACIMA DO SPRITE do pokémon (jogador + inimigo).
-- A ferramenta admin ajusta apenas:
--   * bar_offset  -> altura (em px) da barra acima do sprite
--   * box_opacity -> opacidade do fundo da caixa
-- Rode no SQL Editor do Supabase (logado como admin).
-- OBS: recria a tabela (a versão antiga de posição fixa é substituída).

DROP TABLE IF EXISTS battle_bar_settings;

CREATE TABLE battle_bar_settings (
    background_url TEXT PRIMARY KEY,
    bar_offset NUMERIC NOT NULL DEFAULT 24,
    box_opacity NUMERIC NOT NULL DEFAULT 0.85,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Compatibilidade: se a coluna de opacidade já existia, garante que está presente.
ALTER TABLE battle_bar_settings ADD COLUMN IF NOT EXISTS box_opacity NUMERIC NOT NULL DEFAULT 0.85;
ALTER TABLE battle_bar_settings ADD COLUMN IF NOT EXISTS bar_offset NUMERIC NOT NULL DEFAULT 24;

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
