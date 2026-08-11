-- ============================================================
-- POKEMON PC: Storage system - 20 boxes per character
-- Run this ONCE in Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS pokemon_pc (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    character_id UUID NOT NULL,
    box_number INT NOT NULL CHECK (box_number >= 1 AND box_number <= 20),
    slot_index INT NOT NULL CHECK (slot_index >= 0 AND slot_index < 30),
    species TEXT NOT NULL,
    nickname TEXT,
    level INT DEFAULT 5,
    current_hp INT DEFAULT 0,
    max_hp INT DEFAULT 0,
    experience INT DEFAULT 0,
    moves JSONB DEFAULT '[]',
    pokemon_id INT,
    iv_hp INT DEFAULT 15, iv_attack INT DEFAULT 15, iv_defense INT DEFAULT 15,
    iv_sp_atk INT DEFAULT 15, iv_sp_def INT DEFAULT 15, iv_speed INT DEFAULT 15,
    ev_hp INT DEFAULT 0, ev_attack INT DEFAULT 0, ev_defense INT DEFAULT 0,
    ev_sp_atk INT DEFAULT 0, ev_sp_def INT DEFAULT 0, ev_speed INT DEFAULT 0,
    nature TEXT DEFAULT 'hardy',
    happiness INT DEFAULT 70,
    is_shiny BOOLEAN DEFAULT false,
    is_mega BOOLEAN DEFAULT false,
    held_item_id INT,
    status_effect TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (character_id, box_number, slot_index)
);

-- Index for fast lookups by character
CREATE INDEX IF NOT EXISTS idx_pokemon_pc_character ON pokemon_pc (character_id, box_number);

-- RLS policies
ALTER TABLE pokemon_pc ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own PC pokemon"
    ON pokemon_pc FOR ALL
    USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all PC pokemon"
    ON pokemon_pc FOR ALL
    USING (auth.role() = 'service_role');
