-- =============================================
-- POKEFURY - Tabelas Supabase
-- Cole este código no SQL Editor do Supabase
-- =============================================

-- 1. Tabela de perfis de usuário
CREATE TABLE IF NOT EXISTS profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    display_email TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Time de Pokémon do jogador
CREATE TABLE IF NOT EXISTS pokemon_team (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    species TEXT NOT NULL,
    nickname TEXT,
    level INTEGER DEFAULT 5,
    current_hp INTEGER,
    max_hp INTEGER,
    moves JSONB DEFAULT '[]',
    is_active BOOLEAN DEFAULT true,
    slot INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Histórico de batalhas
CREATE TABLE IF NOT EXISTS battle_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    opponent_name TEXT NOT NULL,
    opponent_team JSONB DEFAULT '[]',
    result TEXT CHECK (result IN ('win', 'lose', 'draw')) NOT NULL,
    xp_gained INTEGER DEFAULT 0,
    battle_log JSONB DEFAULT '[]',
    duration_seconds INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Saves do jogo
CREATE TABLE IF NOT EXISTS game_saves (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL UNIQUE,
    player_name TEXT NOT NULL,
    current_location TEXT DEFAULT 'route-1',
    money INTEGER DEFAULT 0,
    badges INTEGER DEFAULT 0,
    play_time_seconds INTEGER DEFAULT 0,
    starter_pokemon TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE pokemon_team ENABLE ROW LEVEL SECURITY;
ALTER TABLE battle_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_saves ENABLE ROW LEVEL SECURITY;

-- Policies para profiles
CREATE POLICY "Users can view own profile" ON profiles
    FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- Policies para pokemon_team
CREATE POLICY "Users can view own team" ON pokemon_team
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own team" ON pokemon_team
    FOR ALL USING (auth.uid() = user_id);

-- Policies para battle_history
CREATE POLICY "Users can view own battles" ON battle_history
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own battles" ON battle_history
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policies para game_saves
CREATE POLICY "Users can view own save" ON game_saves
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own save" ON game_saves
    FOR ALL USING (auth.uid() = user_id);

-- =============================================
-- TRIGGER: Criar perfil automático ao registrar
-- =============================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO profiles (id, username, display_email)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'username', NEW.email),
        COALESCE(NEW.raw_user_meta_data->>'display_email', NEW.email)
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();
