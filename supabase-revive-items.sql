-- PokeFury - Permitir Revive / Max Revive na mochila de batalha
UPDATE items SET usable_in_battle = true WHERE id IN (20, 21) AND usable_in_battle = false;
SELECT id, name, category, subcategory, usable_in_battle FROM items WHERE id IN (20, 21);
