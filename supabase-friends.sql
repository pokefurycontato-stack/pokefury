-- ============================================================
-- SISTEMA DE AMIZADE + CHAT PRIVADO
-- ============================================================

-- 0. Coluna character_id em city_players (para clique no sprite)
ALTER TABLE city_players ADD COLUMN IF NOT EXISTS character_id UUID;

-- 1. Tabela de amizades (entre personagens)
CREATE TABLE IF NOT EXISTS friendships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id UUID NOT NULL REFERENCES game_saves(id) ON DELETE CASCADE,
  friend_character_id UUID NOT NULL REFERENCES game_saves(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(character_id, friend_character_id)
);

-- 2. Tabela de mensagens privadas
CREATE TABLE IF NOT EXISTS private_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_character_id UUID NOT NULL REFERENCES game_saves(id) ON DELETE CASCADE,
  receiver_character_id UUID NOT NULL REFERENCES game_saves(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. RLS friendships
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "friendships_select" ON friendships;
DROP POLICY IF EXISTS "friendships_insert" ON friendships;
DROP POLICY IF EXISTS "friendships_delete" ON friendships;
CREATE POLICY "friendships_select" ON friendships FOR SELECT USING (
  character_id IN (SELECT id FROM game_saves WHERE user_id = auth.uid())
  OR friend_character_id IN (SELECT id FROM game_saves WHERE user_id = auth.uid())
);
CREATE POLICY "friendships_insert" ON friendships FOR INSERT WITH CHECK (
  character_id IN (SELECT id FROM game_saves WHERE user_id = auth.uid())
);
CREATE POLICY "friendships_delete" ON friendships FOR DELETE USING (
  character_id IN (SELECT id FROM game_saves WHERE user_id = auth.uid())
);

-- 4. RLS private_messages
ALTER TABLE private_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "private_messages_select" ON private_messages;
DROP POLICY IF EXISTS "private_messages_insert" ON private_messages;
CREATE POLICY "private_messages_select" ON private_messages FOR SELECT USING (
  sender_character_id IN (SELECT id FROM game_saves WHERE user_id = auth.uid())
  OR receiver_character_id IN (SELECT id FROM game_saves WHERE user_id = auth.uid())
);
CREATE POLICY "private_messages_insert" ON private_messages FOR INSERT WITH CHECK (
  sender_character_id IN (SELECT id FROM game_saves WHERE user_id = auth.uid())
);

-- 5. Realtime para mensagens privadas
ALTER PUBLICATION supabase_realtime ADD TABLE private_messages;

-- 6. RPC: lista de amigos (com nome + status online)
DROP FUNCTION IF EXISTS get_friends(UUID);
CREATE OR REPLACE FUNCTION get_friends(p_character_id UUID)
RETURNS TABLE (
  friend_character_id UUID,
  name TEXT,
  is_online BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT f.friend_character_id, gs.player_name,
         (COALESCE(gs.last_seen, gs.updated_at) > NOW() - INTERVAL '5 minutes') AS is_online
  FROM friendships f
  JOIN game_saves gs ON gs.id = f.friend_character_id
  WHERE f.character_id = p_character_id
  ORDER BY gs.player_name ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 7. RPC: adicionar amigo
CREATE OR REPLACE FUNCTION add_friend(p_character_id UUID, p_friend_character_id UUID)
RETURNS JSON AS $$
DECLARE
  v_owner UUID;
  v_friend UUID;
  v_exists BOOLEAN;
BEGIN
  SELECT user_id INTO v_owner FROM game_saves WHERE id = p_character_id;
  IF v_owner IS NULL OR v_owner != auth.uid() THEN
    RETURN json_build_object('error', 'Unauthorized');
  END IF;
  SELECT id INTO v_friend FROM game_saves WHERE id = p_friend_character_id;
  IF v_friend IS NULL THEN
    RETURN json_build_object('error', 'Amigo não encontrado');
  END IF;
  IF p_character_id = p_friend_character_id THEN
    RETURN json_build_object('error', 'Você não pode se adicionar');
  END IF;
  SELECT EXISTS(SELECT 1 FROM friendships WHERE character_id = p_character_id AND friend_character_id = p_friend_character_id) INTO v_exists;
  IF v_exists THEN
    RETURN json_build_object('error', 'Já são amigos');
  END IF;
  INSERT INTO friendships (character_id, friend_character_id)
  VALUES (p_character_id, p_friend_character_id);
  RETURN json_build_object('ok', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. RPC: remover amigo
CREATE OR REPLACE FUNCTION remove_friend(p_character_id UUID, p_friend_character_id UUID)
RETURNS JSON AS $$
DECLARE
  v_owner UUID;
BEGIN
  SELECT user_id INTO v_owner FROM game_saves WHERE id = p_character_id;
  IF v_owner IS NULL OR v_owner != auth.uid() THEN
    RETURN json_build_object('error', 'Unauthorized');
  END IF;
  DELETE FROM friendships WHERE character_id = p_character_id AND friend_character_id = p_friend_character_id;
  RETURN json_build_object('ok', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
