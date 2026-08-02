-- ============================================================
-- FIX PROFILES TABLE - versão robusta
-- Resolve erro 500 na tabela profiles
-- ============================================================

-- 1. Criar tabela profiles se não existir
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT,
    display_email TEXT,
    is_admin BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Adicionar colunas uma por uma (seguro)
DO $$ BEGIN
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS username TEXT;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS display_email TEXT;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 3. Índice único para username
DO $$ BEGIN
    CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_unique ON profiles(username);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 4. Habilitar RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 5. Remover TODAS as políticas antigas e recriar
DO $$ BEGIN
    DROP POLICY IF EXISTS "profiles_select_public" ON profiles;
    DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
    DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
    DROP POLICY IF EXISTS "profiles_admin_all" ON profiles;
    DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
    DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
    DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
    DROP POLICY IF EXISTS "Public profiles are readable" ON profiles;
    DROP POLICY IF EXISTS "Anyone can read profiles" ON profiles;
    DROP POLICY IF EXISTS "Admin can manage profiles" ON profiles;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 6. Criar políticas novas
CREATE POLICY "profiles_select_public"
    ON profiles FOR SELECT
    USING (true);

CREATE POLICY "profiles_insert_own"
    ON profiles FOR INSERT
    WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update_own"
    ON profiles FOR UPDATE
    USING (auth.uid() = id);

CREATE POLICY "profiles_admin_all"
    ON profiles FOR ALL
    USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
    );
