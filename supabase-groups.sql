-- =============================================================
-- supabase-groups.sql — Sistema de Grupos/Equipes (3 jogadores)
-- Rode no SQL Editor do Supabase.
-- =============================================================

-- ---------- Tabelas ----------
CREATE TABLE IF NOT EXISTS groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    leader_character_id UUID REFERENCES game_saves(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS group_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    character_id UUID NOT NULL REFERENCES game_saves(id) ON DELETE CASCADE,
    character_name TEXT NOT NULL,
    skin_url TEXT,
    joined_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(group_id, character_id)
);

CREATE TABLE IF NOT EXISTS group_invites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
    sender_character_id UUID NOT NULL REFERENCES game_saves(id) ON DELETE CASCADE,
    sender_name TEXT NOT NULL,
    receiver_character_id UUID NOT NULL REFERENCES game_saves(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS group_messages (
    id BIGSERIAL PRIMARY KEY,
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    character_id UUID REFERENCES game_saves(id) ON DELETE CASCADE,
    player_name TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ---------- RLS ----------
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "groups_select" ON groups;
CREATE POLICY "groups_select" ON groups FOR SELECT USING (true);
DROP POLICY IF EXISTS "groups_write" ON groups;
CREATE POLICY "groups_write" ON groups FOR ALL USING (false) WITH CHECK (false);

ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "group_members_select" ON group_members;
CREATE POLICY "group_members_select" ON group_members FOR SELECT USING (true);
DROP POLICY IF EXISTS "group_members_write" ON group_members;
CREATE POLICY "group_members_write" ON group_members FOR ALL USING (false) WITH CHECK (false);

ALTER TABLE group_invites ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "group_invites_select" ON group_invites;
CREATE POLICY "group_invites_select" ON group_invites FOR SELECT USING (true);
DROP POLICY IF EXISTS "group_invites_write" ON group_invites;
CREATE POLICY "group_invites_write" ON group_invites FOR ALL USING (false) WITH CHECK (false);

ALTER TABLE group_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "group_messages_select" ON group_messages;
CREATE POLICY "group_messages_select" ON group_messages FOR SELECT USING (true);
DROP POLICY IF EXISTS "group_messages_write" ON group_messages;
CREATE POLICY "group_messages_write" ON group_messages FOR ALL USING (false) WITH CHECK (false);

-- ---------- Realtime ----------
ALTER PUBLICATION supabase_realtime ADD TABLE groups;
ALTER PUBLICATION supabase_realtime ADD TABLE group_members;
ALTER PUBLICATION supabase_realtime ADD TABLE group_invites;
ALTER PUBLICATION supabase_realtime ADD TABLE group_messages;

-- ---------- RPCs (SECURITY DEFINER) ----------

-- Envia convite; cria o grupo do remetente se ele ainda não tiver.
CREATE OR REPLACE FUNCTION group_send_invite(p_sender_id UUID, p_sender_name TEXT, p_sender_skin TEXT, p_receiver_id UUID)
RETURNS JSON AS $$
DECLARE
    v_owner UUID;
    v_gid UUID;
    v_cnt INT;
BEGIN
    SELECT user_id INTO v_owner FROM game_saves WHERE id = p_sender_id;
    IF v_owner IS NULL OR v_owner != auth.uid() THEN
        RETURN json_build_object('error', 'Não autorizado');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM game_saves WHERE id = p_receiver_id) THEN
        RETURN json_build_object('error', 'Jogador não encontrado');
    END IF;
    IF EXISTS (SELECT 1 FROM group_members WHERE character_id = p_receiver_id) THEN
        RETURN json_build_object('error', 'Este jogador já está em uma equipe');
    END IF;
    IF EXISTS (SELECT 1 FROM group_invites
               WHERE sender_character_id = p_sender_id
                 AND receiver_character_id = p_receiver_id
                 AND status = 'pending') THEN
        RETURN json_build_object('error', 'Convite já enviado');
    END IF;

    SELECT group_id INTO v_gid FROM group_members WHERE character_id = p_sender_id LIMIT 1;
    IF v_gid IS NULL THEN
        INSERT INTO groups (leader_character_id) VALUES (p_sender_id) RETURNING id INTO v_gid;
        INSERT INTO group_members (group_id, character_id, character_name, skin_url)
        VALUES (v_gid, p_sender_id, p_sender_name, p_sender_skin);
    ELSE
        SELECT COUNT(*) INTO v_cnt FROM group_members WHERE group_id = v_gid;
        IF v_cnt >= 3 THEN
            RETURN json_build_object('error', 'Sua equipe já está cheia (máx. 3)');
        END IF;
    END IF;

    INSERT INTO group_invites (group_id, sender_character_id, sender_name, receiver_character_id)
    VALUES (v_gid, p_sender_id, p_sender_name, p_receiver_id);

    RETURN json_build_object('ok', true, 'group_id', v_gid);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Aceita convite e entra no grupo.
CREATE OR REPLACE FUNCTION group_accept_invite(p_invite_id UUID, p_character_id UUID, p_character_name TEXT, p_skin_url TEXT)
RETURNS JSON AS $$
DECLARE
    v_owner UUID;
    v_gid UUID;
    v_recv UUID;
    v_cnt INT;
BEGIN
    SELECT user_id INTO v_owner FROM game_saves WHERE id = p_character_id;
    IF v_owner IS NULL OR v_owner != auth.uid() THEN
        RETURN json_build_object('error', 'Não autorizado');
    END IF;

    SELECT group_id, receiver_character_id INTO v_gid, v_recv
    FROM group_invites WHERE id = p_invite_id AND status = 'pending';
    IF v_gid IS NULL THEN
        RETURN json_build_object('error', 'Convite não encontrado');
    END IF;
    IF v_recv != p_character_id THEN
        RETURN json_build_object('error', 'Convite não é para você');
    END IF;
    IF EXISTS (SELECT 1 FROM group_members WHERE character_id = p_character_id) THEN
        RETURN json_build_object('error', 'Você já está em uma equipe');
    END IF;

    SELECT COUNT(*) INTO v_cnt FROM group_members WHERE group_id = v_gid;
    IF v_cnt >= 3 THEN
        RETURN json_build_object('error', 'Equipe já está cheia (máx. 3)');
    END IF;

    INSERT INTO group_members (group_id, character_id, character_name, skin_url)
    VALUES (v_gid, p_character_id, p_character_name, p_skin_url);
    UPDATE group_invites SET status = 'accepted' WHERE id = p_invite_id;

    RETURN json_build_object('ok', true, 'group_id', v_gid);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recusa convite.
CREATE OR REPLACE FUNCTION group_decline_invite(p_invite_id UUID, p_character_id UUID)
RETURNS JSON AS $$
DECLARE
    v_owner UUID;
    v_recv UUID;
BEGIN
    SELECT user_id INTO v_owner FROM game_saves WHERE id = p_character_id;
    IF v_owner IS NULL OR v_owner != auth.uid() THEN
        RETURN json_build_object('error', 'Não autorizado');
    END IF;

    SELECT receiver_character_id INTO v_recv FROM group_invites WHERE id = p_invite_id;
    IF v_recv IS NULL OR v_recv != p_character_id THEN
        RETURN json_build_object('error', 'Convite não é para você');
    END IF;

    UPDATE group_invites SET status = 'declined' WHERE id = p_invite_id;
    RETURN json_build_object('ok', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Sai do grupo. Se sobrar 1, o grupo é desfeito (cascade limpa membros e chat).
CREATE OR REPLACE FUNCTION group_leave(p_character_id UUID)
RETURNS JSON AS $$
DECLARE
    v_owner UUID;
    v_gid UUID;
    v_cnt INT;
    v_was_leader BOOLEAN;
    v_new_leader UUID;
BEGIN
    SELECT user_id INTO v_owner FROM game_saves WHERE id = p_character_id;
    IF v_owner IS NULL OR v_owner != auth.uid() THEN
        RETURN json_build_object('error', 'Não autorizado');
    END IF;

    SELECT m.group_id, (g.leader_character_id = p_character_id)
      INTO v_gid, v_was_leader
      FROM group_members m JOIN groups g ON g.id = m.group_id
     WHERE m.character_id = p_character_id;
    IF v_gid IS NULL THEN
        RETURN json_build_object('error', 'Você não está em uma equipe');
    END IF;

    DELETE FROM group_members WHERE group_id = v_gid AND character_id = p_character_id;

    SELECT COUNT(*) INTO v_cnt FROM group_members WHERE group_id = v_gid;
    IF v_cnt <= 1 THEN
        DELETE FROM groups WHERE id = v_gid;
        RETURN json_build_object('ok', true, 'disbanded', true);
    END IF;

    IF v_was_leader THEN
        SELECT character_id INTO v_new_leader FROM group_members WHERE group_id = v_gid ORDER BY joined_at ASC LIMIT 1;
        UPDATE groups SET leader_character_id = v_new_leader WHERE id = v_gid;
    END IF;

    RETURN json_build_object('ok', true, 'disbanded', false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Expulsa um membro do grupo (apenas o líder).
CREATE OR REPLACE FUNCTION group_kick_member(p_leader_id UUID, p_target_id UUID)
RETURNS JSON AS $$
DECLARE
    v_owner UUID;
    v_gid UUID;
    v_cnt INT;
BEGIN
    SELECT user_id INTO v_owner FROM game_saves WHERE id = p_leader_id;
    IF v_owner IS NULL OR v_owner != auth.uid() THEN
        RETURN json_build_object('error', 'Não autorizado');
    END IF;

    SELECT g.id INTO v_gid FROM groups g WHERE g.leader_character_id = p_leader_id;
    IF v_gid IS NULL THEN
        RETURN json_build_object('error', 'Você não é líder de uma equipe');
    END IF;
    IF p_target_id = p_leader_id THEN
        RETURN json_build_object('error', 'Você não pode expulsar a si mesmo');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM group_members WHERE group_id = v_gid AND character_id = p_target_id) THEN
        RETURN json_build_object('error', 'Este jogador não está na sua equipe');
    END IF;

    DELETE FROM group_members WHERE group_id = v_gid AND character_id = p_target_id;

    SELECT COUNT(*) INTO v_cnt FROM group_members WHERE group_id = v_gid;
    IF v_cnt <= 1 THEN
        DELETE FROM groups WHERE id = v_gid;
        RETURN json_build_object('ok', true, 'disbanded', true);
    END IF;

    RETURN json_build_object('ok', true, 'disbanded', false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Envia mensagem para o grupo do personagem.
CREATE OR REPLACE FUNCTION group_send_message(p_character_id UUID, p_message TEXT)
RETURNS JSON AS $$
DECLARE
    v_owner UUID;
    v_gid UUID;
    v_name TEXT;
BEGIN
    SELECT user_id INTO v_owner FROM game_saves WHERE id = p_character_id;
    IF v_owner IS NULL OR v_owner != auth.uid() THEN
        RETURN json_build_object('error', 'Não autorizado');
    END IF;

    SELECT group_id INTO v_gid FROM group_members WHERE character_id = p_character_id LIMIT 1;
    IF v_gid IS NULL THEN
        RETURN json_build_object('error', 'Você não está em uma equipe');
    END IF;

    SELECT player_name INTO v_name FROM game_saves WHERE id = p_character_id;
    INSERT INTO group_messages (group_id, character_id, player_name, message)
    VALUES (v_gid, p_character_id, COALESCE(v_name, 'Treinador'), LEFT(p_message, 200));

    RETURN json_build_object('ok', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Atualiza a skin do membro (usado para manter o sprite atualizado na box).
CREATE OR REPLACE FUNCTION group_update_skin(p_character_id UUID, p_skin_url TEXT)
RETURNS JSON AS $$
DECLARE
    v_owner UUID;
    v_gid UUID;
BEGIN
    SELECT user_id INTO v_owner FROM game_saves WHERE id = p_character_id;
    IF v_owner IS NULL OR v_owner != auth.uid() THEN
        RETURN json_build_object('error', 'Não autorizado');
    END IF;

    SELECT group_id INTO v_gid FROM group_members WHERE character_id = p_character_id LIMIT 1;
    IF v_gid IS NULL THEN
        RETURN json_build_object('error', 'Você não está em uma equipe');
    END IF;

    UPDATE group_members SET skin_url = p_skin_url WHERE group_id = v_gid AND character_id = p_character_id;
    RETURN json_build_object('ok', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;