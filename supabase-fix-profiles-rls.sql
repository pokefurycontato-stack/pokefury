-- ============================================================
-- FIX PROFILES TABLE RLS
-- Garante que novos usuários possam criar seu perfil
-- ============================================================

-- Garantir que a tabela profiles existe com as colunas necessárias
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT,
    display_email TEXT,
    is_admin BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Adicionar colunas se não existirem
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS username TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS display_email TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- Índice único para username (impede duplicatas)
DO $$ BEGIN
    CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_unique ON profiles(username);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Habilitar RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Limpar políticas antigas
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Public profiles are readable" ON profiles;
DROP POLICY IF EXISTS "profiles_select_public" ON profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;

-- Política: qualquer um pode ler perfis (necessário para login)
CREATE POLICY "profiles_select_public" ON profiles
    FOR SELECT USING (true);

-- Política: usuário autenticado pode inserir seu próprio perfil
CREATE POLICY "profiles_insert_own" ON profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- Política: usuário pode atualizar seu próprio perfil
CREATE POLICY "profiles_update_own" ON profiles
    FOR UPDATE USING (auth.uid() = id);

-- Política: admin pode gerenciar todos os perfis
DROP POLICY IF EXISTS "profiles_admin_all" ON profiles;
CREATE POLICY "profiles_admin_all" ON profiles
    FOR ALL USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
    );
