-- Cancelar raid boss ativa
CREATE OR REPLACE FUNCTION cancel_raid_boss()
RETURNS JSON AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT is_admin_user() THEN
    RETURN json_build_object('error', 'Admin only');
  END IF;
  UPDATE raid_bosses SET status = 'defeated', defeated_at = NOW() WHERE status = 'active';
  RETURN json_build_object('ok', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
