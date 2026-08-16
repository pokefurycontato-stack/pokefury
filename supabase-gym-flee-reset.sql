-- =============================================================
-- supabase-gym-flee-reset.sql — Reseta posição de jogador preso
-- no ginásio após fugir da batalha (antes do fix de auto-teleport).
-- =============================================================

-- Troque o UUID abaixo pelo character_id do jogador preso.
-- Para descobrir: SELECT id, character_name FROM characters
--   WHERE character_name ILIKE '%nome%';

DO $$
DECLARE
    v_char_id UUID := 'SUBSTITUA-PELO-CHARACTER_ID'; -- <-- edite aqui
    v_user_id UUID;
    v_npc_pos_x FLOAT;
    v_npc_pos_y FLOAT;
BEGIN
    IF v_char_id = 'SUBSTITUA-PELO-CHARACTER_ID'::uuid THEN
        RAISE EXCEPTION 'Defina o character_id no SQL antes de rodar';
    END IF;

    -- Descobre o user_id do personagem
    SELECT user_id INTO v_user_id FROM characters WHERE id = v_char_id;
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Personagem não encontrado: %', v_char_id;
    END IF;

    -- Posição segura: ao lado do NPC de ginásio (mesmo destino do auto-teleport)
    SELECT pos_x, pos_y INTO v_npc_pos_x, v_npc_pos_y
    FROM city_gym_npc ORDER BY id LIMIT 1;

    -- Reseta a posição na cidade (city_players)
    UPDATE city_players
    SET pos_x = COALESCE(v_npc_pos_x, 0),
        pos_y = COALESCE(v_npc_pos_y, 0) + 70,
        grid_x = 10,
        grid_y = 10,
        direction = 'down'
    WHERE user_id = v_user_id;

    -- Reseta a posição persistida no save (game_saves)
    UPDATE game_saves
    SET city_pos_x = COALESCE(v_npc_pos_x, 0),
        city_pos_y = COALESCE(v_npc_pos_y, 0) + 70
    WHERE id = v_char_id;

    RAISE NOTICE 'Posição resetada para o personagem %', v_char_id;
END $$;