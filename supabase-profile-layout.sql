-- ============================================================
-- PROFILE LAYOUT: configuração das posições dos elementos do Perfil
-- Roda uma vez no SQL Editor do Supabase.
-- ============================================================

CREATE TABLE IF NOT EXISTS profile_layout (
    id INT PRIMARY KEY DEFAULT 1,
    config JSONB NOT NULL DEFAULT '{}',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE profile_layout ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profile_layout_select" ON profile_layout;
CREATE POLICY "profile_layout_select" ON profile_layout FOR SELECT USING (true);

DROP POLICY IF EXISTS "profile_layout_insert" ON profile_layout;
CREATE POLICY "profile_layout_insert" ON profile_layout FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
);

DROP POLICY IF EXISTS "profile_layout_update" ON profile_layout;
CREATE POLICY "profile_layout_update" ON profile_layout FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
);

-- Layout padrão (será sobrescrito ao salvar no editor). Coordenadas em px
-- relativas ao tamanho natural da imagem assets/ferramentas/perfil.png.
INSERT INTO profile_layout (id, config)
VALUES (1, '{
  "bg": "assets/ferramentas/perfil.png",
  "elements": {
    "sprite":     {"x": 40, "y": 40, "w": 120, "h": 120},
    "name":       {"x": 40, "y": 180, "w": 200, "h": 32},
    "level":      {"x": 40, "y": 216, "w": 120, "h": 28},
    "silver":     {"x": 40, "y": 260, "w": 160, "h": 26},
    "gold":       {"x": 40, "y": 292, "w": 160, "h": 26},
    "diamond":    {"x": 40, "y": 324, "w": 160, "h": 26},
    "badges":     {"x": 40, "y": 380, "w": 260, "h": 120},
    "badgesPrev": {"x": 34, "y": 430, "w": 40, "h": 40},
    "badgesNext": {"x": 266, "y": 430, "w": 40, "h": 40},
    "title1":     {"x": 340, "y": 380, "w": 200, "h": 24},
    "title2":     {"x": 340, "y": 406, "w": 200, "h": 24},
    "title3":     {"x": 340, "y": 432, "w": 200, "h": 24},
    "title4":     {"x": 340, "y": 458, "w": 200, "h": 24},
    "title5":     {"x": 340, "y": 484, "w": 200, "h": 24},
    "titlesMore": {"x": 560, "y": 380, "w": 40, "h": 40},
    "benefits":   {"x": 340, "y": 40, "w": 220, "h": 300},
    "logout":     {"x": 40, "y": 460, "w": 160, "h": 36},
    "switchChar": {"x": 40, "y": 500, "w": 160, "h": 36},
    "closeBtn":   {"x": 560, "y": 10, "w": 40, "h": 40}
  }
}'::jsonb)
ON CONFLICT (id) DO NOTHING;