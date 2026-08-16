-- =============================================================
-- supabase-weather.sql — Clima forçado (painel admin)
-- Rode no SQL Editor do Supabase.
-- =============================================================

-- ---------- Tabela ----------
CREATE TABLE IF NOT EXISTS forced_weather (
    id BIGSERIAL PRIMARY KEY,
    weather TEXT NOT NULL,
    ends_at TIMESTAMPTZ NOT NULL,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ---------- RLS ----------
ALTER TABLE forced_weather ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "forced_weather_select" ON forced_weather;
CREATE POLICY "forced_weather_select" ON forced_weather FOR SELECT USING (true);
DROP POLICY IF EXISTS "forced_weather_write" ON forced_weather;
CREATE POLICY "forced_weather_write" ON forced_weather FOR ALL USING (false) WITH CHECK (false);

-- ---------- Realtime ----------
ALTER PUBLICATION supabase_realtime ADD TABLE forced_weather;

-- ---------- RPC (SECURITY DEFINER, só admin) ----------
CREATE OR REPLACE FUNCTION force_weather(p_weather TEXT)
RETURNS JSON AS $$
DECLARE
    v_admin BOOLEAN;
BEGIN
    SELECT is_admin INTO v_admin FROM profiles WHERE id = auth.uid();
    IF v_admin IS NOT TRUE THEN
        RETURN json_build_object('error', 'Apenas administradores podem forçar o clima');
    END IF;

    DELETE FROM forced_weather;

    INSERT INTO forced_weather (weather, ends_at, created_by)
    VALUES (p_weather, now() + interval '15 minutes', auth.uid());

    RETURN json_build_object('ok', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;