-- ============================================================
-- CHAT PRIVADO: colunas extras
-- ============================================================

-- Nome do personagem no chat global (para tornar clicavel)
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS character_id UUID;

-- Nome do remetente na mensagem privada (para lista de conversas)
ALTER TABLE private_messages ADD COLUMN IF NOT EXISTS sender_name TEXT;
