-- Tabela de máscaras de efeito para fundos de batalha
-- Cada fundo pode ter uma máscara pintada com pincel que define onde efeitos animados acontecem

CREATE TABLE IF NOT EXISTS battle_effect_masks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    background_url TEXT UNIQUE NOT NULL,
    mask_data TEXT,
    effect_type TEXT DEFAULT 'none',
    brush_size INTEGER DEFAULT 40,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índice para busca rápida por background_url
CREATE INDEX IF NOT EXISTS idx_battle_effect_masks_bg_url ON battle_effect_masks(background_url);

-- RLS (Row Level Security)
ALTER TABLE battle_effect_masks ENABLE ROW LEVEL SECURITY;

-- Permitir leitura para todos autenticados
CREATE POLICY "Allow read for authenticated" ON battle_effect_masks
    FOR SELECT USING (auth.role() = 'authenticated');

-- Permitir inserção/atualização para todos autenticados
CREATE POLICY "Allow insert/update for authenticated" ON battle_effect_masks
    FOR ALL USING (auth.role() = 'authenticated');

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_battle_effect_masks_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_battle_effect_masks_updated_at ON battle_effect_masks;
CREATE TRIGGER update_battle_effect_masks_updated_at
    BEFORE UPDATE ON battle_effect_masks
    FOR EACH ROW
    EXECUTE FUNCTION update_battle_effect_masks_timestamp();
