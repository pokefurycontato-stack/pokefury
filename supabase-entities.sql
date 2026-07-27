-- Persist map Pokemon entities per character per map
CREATE TABLE IF NOT EXISTS map_pokemon_entities (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    character_id UUID NOT NULL REFERENCES game_saves(id) ON DELETE CASCADE,
    map_id UUID NOT NULL REFERENCES region_maps(id) ON DELETE CASCADE,
    encounter_id UUID NOT NULL REFERENCES map_encounters(id) ON DELETE CASCADE,
    pos_x INT NOT NULL,
    pos_y INT NOT NULL,
    active BOOLEAN DEFAULT true,
    respawn_timer INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_map_pokemon_entities_char_map
    ON map_pokemon_entities(character_id, map_id);

-- RLS
ALTER TABLE map_pokemon_entities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Players manage own map entities"
    ON map_pokemon_entities FOR ALL
    USING (character_id IN (SELECT id FROM game_saves WHERE user_id = auth.uid()));
