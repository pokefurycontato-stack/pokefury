-- Tabela para rastrear pokemons criados pela ferramenta admin
CREATE TABLE IF NOT EXISTS event_pokemon (
    id SERIAL PRIMARY KEY,
    pokemon_id INTEGER NOT NULL REFERENCES pokemon(id) ON DELETE CASCADE,
    base_pokemon_id INTEGER,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE event_pokemon ENABLE ROW LEVEL SECURITY;

CREATE POLICY "event_pokemon_select" ON event_pokemon FOR SELECT USING (true);
CREATE POLICY "event_pokemon_insert" ON event_pokemon FOR INSERT WITH CHECK (true);
CREATE POLICY "event_pokemon_delete" ON event_pokemon FOR DELETE USING (true);

-- Função RPC para criar pokemon de evento
CREATE OR REPLACE FUNCTION create_event_pokemon(
    p_name TEXT,
    p_types TEXT[],
    p_hp INTEGER,
    p_attack INTEGER,
    p_defense INTEGER,
    p_sp_atk INTEGER,
    p_sp_def INTEGER,
    p_speed INTEGER,
    p_sprite_front TEXT,
    p_sprite_back TEXT,
    p_sprite_official TEXT,
    p_base_pokemon_id INTEGER,
    p_ability_ids INTEGER[],
    p_ability_slots INTEGER[],
    p_ability_hidden BOOLEAN[]
) RETURNS INTEGER AS $$
DECLARE
    new_id INTEGER;
    max_id INTEGER;
    i INTEGER;
BEGIN
    -- Pegar próximo ID
    SELECT COALESCE(MAX(id), 0) + 1 INTO max_id FROM pokemon;
    new_id := max_id;

    -- Inserir pokemon
    INSERT INTO pokemon (id, name, types, hp, attack, defense, sp_atk, sp_def, speed,
                         sprite_front, sprite_back, sprite_official, sprite_home,
                         variant, base_pokemon_id)
    VALUES (new_id, p_name, p_types, p_hp, p_attack, p_defense, p_sp_atk, p_sp_def, p_speed,
            p_sprite_front, p_sprite_back, p_sprite_official, p_sprite_official,
            'event', p_base_pokemon_id);

    -- Copiar moves do pokemon base se informado
    IF p_base_pokemon_id IS NOT NULL THEN
        INSERT INTO pokemon_moves_v2 (pokemon_id, move_id, learn_method, level_learned)
        SELECT new_id, move_id, learn_method, level_learned
        FROM pokemon_moves_v2
        WHERE pokemon_id = p_base_pokemon_id;
    END IF;

    -- Inserir habilidades
    IF p_ability_ids IS NOT NULL THEN
        FOR i IN 1..array_length(p_ability_ids, 1) LOOP
            INSERT INTO pokemon_abilities (pokemon_id, ability_id, slot, is_hidden)
            VALUES (new_id, p_ability_ids[i], p_ability_slots[i], p_ability_hidden[i]);
        END LOOP;
    END IF;

    -- Registrar na tabela de eventos
    INSERT INTO event_pokemon (pokemon_id, base_pokemon_id, created_by)
    VALUES (new_id, p_base_pokemon_id, auth.uid());

    RETURN new_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
