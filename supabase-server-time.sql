-- Server time function for universal day/night cycle
CREATE OR REPLACE FUNCTION get_server_time()
RETURNS BIGINT AS $$
BEGIN
  RETURN (EXTRACT(EPOCH FROM now()) * 1000)::BIGINT;
END;
$$ LANGUAGE plpgsql;
