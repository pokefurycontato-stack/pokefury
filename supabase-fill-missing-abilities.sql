-- ===========================================================================
-- POKEFURY: GARANTE QUE TODOS OS POKEMON TENHAM ABILITY
-- ===========================================================================
-- PROBLEMA:
--   O seed `scripts/fetch-abilities-moves.js` consultava a PokeAPI
--   `pokemon/{id}` usando o id gravado na tabela `pokemon`. Os IDs
--   CUSTOM que representam formas / variantes / G-MAX / lendarios
--   especiais (10001..13069) NAO existem na PokeAPI, entao aqueles
--   pokemon ficaram SEM ability em `pokemon_abilities`.
--
-- SOLUCAO:
--   1) Para cada pokemon que NAO tem nenhuma ability, usa a cadeia de
--      `base_pokemon_id` (ancestral real; ex: 13002 -> 898 Calyrex,
--      11005 -> 68 Machamp) para copiar as abilities reais do
--      ancestral raiz (que ja estao na tabela), incluindo todos os
--      slots (slot 1 / slot 2 / hidden).
--   2) Fallback final: se ainda ficar algum sem ability, usa a ability
--      de menor id da tabela, garantindo que NENHUM pokemon fique sem.
--
-- ===========================================================================

-- 1) Insere, para cada pokemon que hoje NAO tem ability, todas as
--    abilities do seu ancestral raiz (via recursion de base_pokemon_id).
WITH RECURSIVE base_roots AS (
    SELECT id AS descendant, id AS root
    FROM pokemon
    WHERE base_pokemon_id IS NULL OR base_pokemon_id = id

    UNION ALL

    SELECT p.id AS descendant, br.root
    FROM pokemon p
    JOIN base_roots br ON p.base_pokemon_id = br.descendant
)
INSERT INTO pokemon_abilities (pokemon_id, ability_id, slot, is_hidden)
SELECT br.descendant, pa.ability_id, pa.slot, pa.is_hidden
FROM base_roots br
JOIN pokemon_abilities pa ON pa.pokemon_id = br.root
WHERE br.descendant <> br.root
  AND NOT EXISTS (
      SELECT 1 FROM pokemon_abilities ex WHERE ex.pokemon_id = br.descendant
  )
ON CONFLICT (pokemon_id, ability_id) DO NOTHING;

-- 2) Fallback generico: para qualquer pokemon que ainda esteja sem ability
--    (por exemplo, pokemon sem base e sem ability registada), usa a ability
--    de menor id da tabela. Garante 0 pokemon sem ability.
DO $$
DECLARE
    v_generic_id INTEGER;
    r RECORD;
BEGIN
    SELECT MIN(id) INTO v_generic_id FROM abilities;
    IF v_generic_id IS NULL THEN
        RETURN; -- tabela abilities vazia: nao ha o que fazer
    END IF;

    FOR r IN
        SELECT p.id
        FROM pokemon p
        WHERE NOT EXISTS (
            SELECT 1 FROM pokemon_abilities a WHERE a.pokemon_id = p.id
        )
    LOOP
        INSERT INTO pokemon_abilities (pokemon_id, ability_id, slot, is_hidden)
        VALUES (r.id, v_generic_id, 1, false)
        ON CONFLICT (pokemon_id, ability_id) DO NOTHING;
    END LOOP;
END $$;

-- 3) Verificacao: deve retornar 0 linhas (nenhum pokemon sem ability).
SELECT p.id, p.name
FROM pokemon p
WHERE NOT EXISTS (
    SELECT 1 FROM pokemon_abilities a WHERE a.pokemon_id = p.id
);