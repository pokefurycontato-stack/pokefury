-- =============================================
-- MIGRAÇÃO: Múltiplos Personagens por Conta
-- Execute no SQL Editor do Supabase
-- Pode ser executada várias vezes com segurança
-- =============================================

-- 1. Adicionar colunas necessárias à tabela game_saves
DO $$ BEGIN
    ALTER TABLE game_saves ADD COLUMN id UUID DEFAULT uuid_generate_v4();
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE game_saves ADD COLUMN avatar_url TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- 2. Preencher ids existentes que estejam null
UPDATE game_saves SET id = uuid_generate_v4() WHERE id IS NULL;

-- 3. Remover QUALQUER PRIMARY KEY existente em game_saves
DO $$ DECLARE
    rec RECORD;
BEGIN
    FOR rec IN SELECT conname FROM pg_constraint
               WHERE conrelid = 'game_saves'::regclass
               AND contype = 'p'
    LOOP
        EXECUTE 'ALTER TABLE game_saves DROP CONSTRAINT IF EXISTS ' || rec.conname;
        RAISE NOTICE 'Dropped primary key: %', rec.conname;
    END LOOP;
END $$;

-- 4. Remover QUALQUER UNIQUE constraint em user_id
DO $$ DECLARE
    rec RECORD;
BEGIN
    FOR rec IN SELECT conname FROM pg_constraint
               WHERE conrelid = 'game_saves'::regclass
               AND contype = 'u'
    LOOP
        EXECUTE 'ALTER TABLE game_saves DROP CONSTRAINT IF EXISTS ' || rec.conname;
        RAISE NOTICE 'Dropped unique constraint: %', rec.conname;
    END LOOP;
END $$;

-- 5. Remover índices únicos em user_id
DO $$ DECLARE
    idx RECORD;
BEGIN
    FOR idx IN SELECT indexname FROM pg_indexes
               WHERE tablename = 'game_saves'
               AND indexdef LIKE '%UNIQUE%'
    LOOP
        EXECUTE 'DROP INDEX IF EXISTS ' || idx.indexname;
        RAISE NOTICE 'Dropped unique index: %', idx.indexname;
    END LOOP;
END $$;

-- 6. Adicionar PRIMARY KEY em id
ALTER TABLE game_saves ADD PRIMARY KEY (id);

-- 7. Criar view characters
CREATE OR REPLACE VIEW characters AS SELECT * FROM game_saves;

-- 8. Adicionar character_id nas tabelas filhas
DO $$ BEGIN
    ALTER TABLE pokemon_team ADD COLUMN character_id UUID REFERENCES game_saves(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE player_inventory ADD COLUMN character_id UUID REFERENCES game_saves(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE battle_history ADD COLUMN character_id UUID REFERENCES game_saves(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- 9. Migrar dados existentes
UPDATE pokemon_team pt
SET character_id = gs.id
FROM game_saves gs
WHERE pt.user_id = gs.user_id
AND pt.character_id IS NULL;

UPDATE player_inventory pi
SET character_id = gs.id
FROM game_saves gs
WHERE pi.user_id = gs.user_id
AND pi.character_id IS NULL;

UPDATE battle_history bh
SET character_id = gs.id
FROM game_saves gs
WHERE bh.user_id = gs.user_id
AND bh.character_id IS NULL;

-- 10. Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_game_saves_user_id ON game_saves(user_id);
CREATE INDEX IF NOT EXISTS idx_pokemon_team_character_id ON pokemon_team(character_id);
CREATE INDEX IF NOT EXISTS idx_player_inventory_character_id ON player_inventory(character_id);
CREATE INDEX IF NOT EXISTS idx_battle_history_character_id ON battle_history(character_id);

-- 11. RLS para pokemon_team
ALTER TABLE pokemon_team ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    DROP POLICY IF EXISTS "pokemonteam_select" ON pokemon_team;
    DROP POLICY IF EXISTS "pokemonteam_insert" ON pokemon_team;
    DROP POLICY IF EXISTS "pokemonteam_update" ON pokemon_team;
    DROP POLICY IF EXISTS "pokemonteam_delete" ON pokemon_team;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "pokemonteam_select" ON pokemon_team
    FOR SELECT USING (
        auth.uid() = user_id OR
        character_id IN (SELECT id FROM game_saves WHERE user_id = auth.uid())
    );
CREATE POLICY "pokemonteam_insert" ON pokemon_team
    FOR INSERT WITH CHECK (
        auth.uid() = user_id OR
        character_id IN (SELECT id FROM game_saves WHERE user_id = auth.uid())
    );
CREATE POLICY "pokemonteam_update" ON pokemon_team
    FOR UPDATE USING (
        auth.uid() = user_id OR
        character_id IN (SELECT id FROM game_saves WHERE user_id = auth.uid())
    );
CREATE POLICY "pokemonteam_delete" ON pokemon_team
    FOR DELETE USING (
        auth.uid() = user_id OR
        character_id IN (SELECT id FROM game_saves WHERE user_id = auth.uid())
    );

-- 12. RLS para player_inventory
ALTER TABLE player_inventory ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    DROP POLICY IF EXISTS "inventory_select" ON player_inventory;
    DROP POLICY IF EXISTS "inventory_insert" ON player_inventory;
    DROP POLICY IF EXISTS "inventory_update" ON player_inventory;
    DROP POLICY IF EXISTS "inventory_delete" ON player_inventory;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "inventory_select" ON player_inventory
    FOR SELECT USING (
        auth.uid() = user_id OR
        character_id IN (SELECT id FROM game_saves WHERE user_id = auth.uid())
    );
CREATE POLICY "inventory_insert" ON player_inventory
    FOR INSERT WITH CHECK (
        auth.uid() = user_id OR
        character_id IN (SELECT id FROM game_saves WHERE user_id = auth.uid())
    );
CREATE POLICY "inventory_update" ON player_inventory
    FOR UPDATE USING (
        auth.uid() = user_id OR
        character_id IN (SELECT id FROM game_saves WHERE user_id = auth.uid())
    );
CREATE POLICY "inventory_delete" ON player_inventory
    FOR DELETE USING (
        auth.uid() = user_id OR
        character_id IN (SELECT id FROM game_saves WHERE user_id = auth.uid())
    );

-- 13. RLS para battle_history
ALTER TABLE battle_history ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    DROP POLICY IF EXISTS "battlehistory_select" ON battle_history;
    DROP POLICY IF EXISTS "battlehistory_insert" ON battle_history;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "battlehistory_select" ON battle_history
    FOR SELECT USING (
        auth.uid() = user_id OR
        character_id IN (SELECT id FROM game_saves WHERE user_id = auth.uid())
    );
CREATE POLICY "battlehistory_insert" ON battle_history
    FOR INSERT WITH CHECK (
        auth.uid() = user_id OR
        character_id IN (SELECT id FROM game_saves WHERE user_id = auth.uid())
    );

-- 14. Criar tabela de currencies por personagem
CREATE TABLE IF NOT EXISTS character_currencies (
    character_id UUID PRIMARY KEY REFERENCES game_saves(id) ON DELETE CASCADE,
    diamonds INTEGER DEFAULT 0,
    gold INTEGER DEFAULT 0,
    silver INTEGER DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE character_currencies ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    DROP POLICY IF EXISTS "currency_select" ON character_currencies;
    DROP POLICY IF EXISTS "currency_insert" ON character_currencies;
    DROP POLICY IF EXISTS "currency_update" ON character_currencies;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "currency_select" ON character_currencies
    FOR SELECT USING (
        character_id IN (SELECT id FROM game_saves WHERE user_id = auth.uid())
    );
CREATE POLICY "currency_insert" ON character_currencies
    FOR INSERT WITH CHECK (
        character_id IN (SELECT id FROM game_saves WHERE user_id = auth.uid())
    );
CREATE POLICY "currency_update" ON character_currencies
    FOR UPDATE USING (
        character_id IN (SELECT id FROM game_saves WHERE user_id = auth.uid())
    );
