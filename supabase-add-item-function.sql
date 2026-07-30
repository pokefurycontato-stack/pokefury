CREATE OR REPLACE FUNCTION public.add_item(p_item_id INT, p_qty INT DEFAULT 1, p_character_id UUID DEFAULT NULL)
RETURNS VOID AS $$
DECLARE
    target_char UUID;
BEGIN
    target_char := COALESCE(p_character_id, current_setting('request.jwt.claims', true)::json->>'character_id');
    IF target_char IS NULL THEN
        RAISE EXCEPTION 'No character_id provided';
    END IF;

    INSERT INTO player_inventory (character_id, item_id, quantity)
    VALUES (target_char, p_item_id, p_qty)
    ON CONFLICT (character_id, item_id)
    DO UPDATE SET quantity = player_inventory.quantity + p_qty;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
