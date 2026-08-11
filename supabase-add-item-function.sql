CREATE OR REPLACE FUNCTION public.add_item(p_item_id INT, p_qty INT DEFAULT 1, p_character_id UUID DEFAULT NULL, p_user_id UUID DEFAULT NULL)
RETURNS VOID AS $$
DECLARE
    target_char UUID;
    target_user UUID;
BEGIN
    IF p_character_id IS NOT NULL THEN
        target_char := p_character_id;
    ELSE
        target_char := (current_setting('request.jwt.claims', true)::json->>'character_id')::uuid;
    END IF;

    IF p_user_id IS NOT NULL THEN
        target_user := p_user_id;
    ELSE
        target_user := (current_setting('request.jwt.claims', true)::json->>'sub')::uuid;
    END IF;

    INSERT INTO player_inventory (user_id, character_id, item_id, quantity)
    VALUES (target_user, target_char, p_item_id, p_qty)
    ON CONFLICT (character_id, item_id)
    DO UPDATE SET quantity = player_inventory.quantity + p_qty;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
