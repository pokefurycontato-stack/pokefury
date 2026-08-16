-- =============================================================
-- supabase-reset-position.sql — Reset de posição (admin)
-- Teleporta um jogador para o spawn padrão da cidade em tempo real.
-- Rode no SQL Editor do Supabase.
-- =============================================================

-- ---------- Tabela de notificação (realtime) ----------
CREATE TABLE IF NOT EXISTS city_forced_teleports (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL,
    character_id UUID,
    pos_x FLOAT NOT NULL,
    pos_y FLOAT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE city_forced_teleports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "city_forced_teleports_select" ON city_forced_teleports;
CREATE POLICY "city_forced_teleports_select" ON city_forced_teleports FOR SELECT USING (true);
DROP POLICY IF EXISTS "city_forced_teleports_write" ON city_forced_teleports;
CREATE POLICY "city_forced_teleports_write" ON city_forced_teleports FOR ALL USING (false) WITH CHECK (false);

ALTER PUBLICATION supabase_realtime ADD TABLE city_forced_teleports;

-- ---------- RPC (SECURITY DEFINER, só admin) ----------
CREATE OR REPLACE FUNCTION reset_player_position(p_user_id UUID)
RETURNS JSON AS $$
DECLARE
    v_admin BOOLEAN;
    v_char_id UUID;
    v_spawn_x FLOAT;
    v_spawn_y FLOAT;
BEGIN
    SELECT is_admin INTO v_admin FROM profiles WHERE id = auth.uid();
    IF v_admin IS NOT TRUE THEN
        RETURN json_build_object('error', 'Apenas administradores podem resetar posições');
    END IF;

    -- Descobre o último personagem do usuário
    SELECT id INTO v_char_id FROM game_saves
    WHERE user_id = p_user_id
    ORDER BY COALESCE(last_seen, updated_at) DESC NULLS LAST
    LIMIT 1;

    -- Posição de spawn padrão da cidade (city_player_spawn id 1, fallback 400,400)
    SELECT pos_x, pos_y INTO v_spawn_x, v_spawn_y
    FROM city_player_spawn WHERE id = 1;
    IF v_spawn_x IS NULL THEN v_spawn_x := 400; v_spawn_y := 400; END IF;

    -- Atualiza posição em tempo real (city_players)
    UPDATE city_players
    SET pos_x = v_spawn_x, pos_y = v_spawn_y, direction = 'down', grid_x = 10, grid_y = 10
    WHERE user_id = p_user_id;

    -- Atualiza posição persistida (game_saves)
    IF v_char_id IS NOT NULL THEN
        UPDATE game_saves SET city_pos_x = v_spawn_x, city_pos_y = v_spawn_y WHERE id = v_char_id;
    END IF;

    -- Notificação realtime para teleportar o cliente imediatamente
    INSERT INTO city_forced_teleports (user_id, character_id, pos_x, pos_y)
    VALUES (p_user_id, v_char_id, v_spawn_x, v_spawn_y);

    RETURN json_build_object('success', true, 'pos_x', v_spawn_x, 'pos_y', v_spawn_y);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

SELECT 'reset_player_position installed' AS status;