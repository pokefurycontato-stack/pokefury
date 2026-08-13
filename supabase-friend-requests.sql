-- ============================================================
-- PEDIDOS DE AMIZADE (convite aceitar/negar)
-- ============================================================

-- 1. Tabela de pedidos de amizade
CREATE TABLE IF NOT EXISTS friend_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_character_id UUID NOT NULL REFERENCES game_saves(id) ON DELETE CASCADE,
  receiver_character_id UUID NOT NULL REFERENCES game_saves(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  responded_at TIMESTAMPTZ
);

-- 2. RLS
ALTER TABLE friend_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "friend_requests_select" ON friend_requests;
DROP POLICY IF EXISTS "friend_requests_insert" ON friend_requests;
DROP POLICY IF EXISTS "friend_requests_update" ON friend_requests;
CREATE POLICY "friend_requests_select" ON friend_requests FOR SELECT USING (
  sender_character_id IN (SELECT id FROM game_saves WHERE user_id = auth.uid())
  OR receiver_character_id IN (SELECT id FROM game_saves WHERE user_id = auth.uid())
);
CREATE POLICY "friend_requests_insert" ON friend_requests FOR INSERT WITH CHECK (
  sender_character_id IN (SELECT id FROM game_saves WHERE user_id = auth.uid())
);
CREATE POLICY "friend_requests_update" ON friend_requests FOR UPDATE USING (
  receiver_character_id IN (SELECT id FROM game_saves WHERE user_id = auth.uid())
);

-- 3. Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE friend_requests;

-- 4. RPC: enviar pedido de amizade
CREATE OR REPLACE FUNCTION send_friend_request(p_character_id UUID, p_friend_character_id UUID)
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
  SELECT EXISTS(SELECT 1 FROM friend_requests WHERE sender_character_id = p_character_id AND receiver_character_id = p_friend_character_id AND status = 'pending') INTO v_exists;
  IF v_exists THEN
    RETURN json_build_object('error', 'Convite já enviado');
  END IF;
  SELECT EXISTS(SELECT 1 FROM friend_requests WHERE sender_character_id = p_friend_character_id AND receiver_character_id = p_character_id AND status = 'pending') INTO v_exists;
  IF v_exists THEN
    RETURN json_build_object('error', 'Este jogador já te enviou um convite');
  END IF;
  INSERT INTO friend_requests (sender_character_id, receiver_character_id) VALUES (p_character_id, p_friend_character_id);
  RETURN json_build_object('ok', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. RPC: responder pedido de amizade (aceitar/negar)
CREATE OR REPLACE FUNCTION respond_friend_request(p_request_id UUID, p_accept BOOLEAN)
RETURNS JSON AS $$
DECLARE
  v_req RECORD;
  v_owner UUID;
BEGIN
  SELECT * INTO v_req FROM friend_requests WHERE id = p_request_id;
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Convite não encontrado');
  END IF;
  IF v_req.status != 'pending' THEN
    RETURN json_build_object('error', 'Convite já respondido');
  END IF;
  SELECT user_id INTO v_owner FROM game_saves WHERE id = v_req.receiver_character_id;
  IF v_owner IS NULL OR v_owner != auth.uid() THEN
    RETURN json_build_object('error', 'Unauthorized');
  END IF;
  IF p_accept THEN
    INSERT INTO friendships (character_id, friend_character_id) VALUES (v_req.sender_character_id, v_req.receiver_character_id) ON CONFLICT DO NOTHING;
    INSERT INTO friendships (character_id, friend_character_id) VALUES (v_req.receiver_character_id, v_req.sender_character_id) ON CONFLICT DO NOTHING;
  END IF;
  UPDATE friend_requests SET status = CASE WHEN p_accept THEN 'accepted' ELSE 'declined' END, responded_at = NOW() WHERE id = p_request_id;
  RETURN json_build_object('ok', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. RPC: pedidos pendentes (com nome do remetente)
CREATE OR REPLACE FUNCTION get_pending_friend_requests(p_character_id UUID)
RETURNS TABLE (id UUID, sender_character_id UUID, sender_name TEXT, created_at TIMESTAMPTZ) AS $$
BEGIN
  RETURN QUERY
  SELECT fr.id, fr.sender_character_id, gs.player_name, fr.created_at
  FROM friend_requests fr
  JOIN game_saves gs ON gs.id = fr.sender_character_id
  WHERE fr.receiver_character_id = p_character_id AND fr.status = 'pending'
  ORDER BY fr.created_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 7. Atualizar remover amigo para apagar os dois lados
CREATE OR REPLACE FUNCTION remove_friend(p_character_id UUID, p_friend_character_id UUID)
RETURNS JSON AS $$
DECLARE
  v_owner UUID;
BEGIN
  SELECT user_id INTO v_owner FROM game_saves WHERE id = p_character_id;
  IF v_owner IS NULL OR v_owner != auth.uid() THEN
    RETURN json_build_object('error', 'Unauthorized');
  END IF;
  DELETE FROM friendships
  WHERE (character_id = p_character_id AND friend_character_id = p_friend_character_id)
     OR (character_id = p_friend_character_id AND friend_character_id = p_character_id);
  RETURN json_build_object('ok', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
