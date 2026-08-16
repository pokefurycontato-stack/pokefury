-- =============================================================
-- supabase-weather.sql — Clima forçado (painel admin)
-- Idempotente: pode rodar novamente sem erro.
-- Rode no SQL Editor do Supabase.
-- =============================================================

-- ---------- Tabela (idempotente) ----------
CREATE TABLE IF NOT EXISTS forced_weather (
    id BIGSERIAL PRIMARY KEY,
    weather TEXT NOT NULL,
    ends_at TIMESTAMPTZ NOT NULL,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Garante as colunas mesmo se a tabela foi criada antes com outro schema
ALTER TABLE forced_weather ADD COLUMN IF NOT EXISTS weather TEXT NOT NULL DEFAULT 'clear';
ALTER TABLE forced_weather ADD COLUMN IF NOT EXISTS ends_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE forced_weather ADD COLUMN IF NOT EXISTS created_by UUID;

-- ---------- RLS ----------
ALTER TABLE forced_weather ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "forced_weather_select" ON forced_weather;
CREATE POLICY "forced_weather_select" ON forced_weather FOR SELECT USING (true);
DROP POLICY IF EXISTS "forced_weather_write" ON forced_weather;
CREATE POLICY "forced_weather_write" ON forced_weather FOR ALL USING (false) WITH CHECK (false);

-- ---------- Realtime (idempotente) ----------
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'forced_weather'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE forced_weather;
    END IF;
END $$;

-- ---------- RPC (SECURITY DEFINER, só admin) ----------
DROP FUNCTION IF EXISTS public.force_weather(text);

CREATE FUNCTION force_weather(p_weather TEXT)
RETURNS JSON LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
    v_admin BOOLEAN;
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN json_build_object('error', 'Não autenticado');
    END IF;

    SELECT is_admin INTO v_admin FROM profiles WHERE id = auth.uid();
    IF v_admin IS NOT TRUE THEN
        RETURN json_build_object('error', 'Apenas administradores podem forçar o clima');
    END IF;

    DELETE FROM forced_weather;

    INSERT INTO forced_weather (weather, ends_at, created_by)
    VALUES (p_weather, now() + interval '15 minutes', auth.uid());

    RETURN json_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.force_weather(text) TO authenticated, anon;