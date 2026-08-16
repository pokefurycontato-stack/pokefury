-- ============================================================
-- FIX: POKEMON SPAWN TIME — policy de leitura pública
-- ============================================================
-- O radar (cliente) consulta pokemon_spawn_time via window.db.
-- Se RLS estiver ativo sem policy, o SELECT volta vazio e o radar
-- mostra tudo como "Qualquer horário". O servidor não era afetado
-- porque roll_spawn_by_biome é SECURITY DEFINER (ignora RLS).
-- Este script garante leitura pública + recarrega os dados.

ALTER TABLE pokemon_spawn_time ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pokemon_spawn_time_select" ON pokemon_spawn_time;
CREATE POLICY "pokemon_spawn_time_select" ON pokemon_spawn_time
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "pokemon_spawn_time_insert" ON pokemon_spawn_time;
CREATE POLICY "pokemon_spawn_time_insert" ON pokemon_spawn_time
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "pokemon_spawn_time_update" ON pokemon_spawn_time;
CREATE POLICY "pokemon_spawn_time_update" ON pokemon_spawn_time
  FOR UPDATE USING (true);

-- Recarrega a lista de dia/noite (mesmo dataset do supabase-spawn-time.sql)
DELETE FROM pokemon_spawn_time;

-- Nocturnal pokemon (so aparecem de noite)
INSERT INTO pokemon_spawn_time (pokemon_id, time_of_day) VALUES
(19,'night'),(20,'night'),(41,'night'),(42,'night'),(169,'night'),
(92,'night'),(93,'night'),(94,'night'),(163,'night'),(164,'night'),
(198,'night'),(200,'night'),(215,'night'),(461,'night'),
(228,'night'),(229,'night'),(167,'night'),(168,'night'),
(261,'night'),(262,'night'),(302,'night'),(353,'night'),(354,'night'),
(355,'night'),(356,'night'),(477,'night'),(358,'night'),
(207,'night'),(472,'night'),(434,'night'),(435,'night'),
(425,'night'),(426,'night'),(442,'night'),(453,'night'),(454,'night'),
(331,'night'),(332,'night'),(48,'night'),(49,'night'),
(96,'night'),(97,'night'),(35,'night'),(36,'night'),(46,'night'),(47,'night')
ON CONFLICT (pokemon_id) DO UPDATE SET time_of_day = EXCLUDED.time_of_day;

-- Diurnal pokemon (so aparecem de dia)
INSERT INTO pokemon_spawn_time (pokemon_id, time_of_day) VALUES
(10,'day'),(11,'day'),(12,'day'),(13,'day'),(14,'day'),(15,'day'),
(16,'day'),(17,'day'),(18,'day'),(21,'day'),(22,'day'),(43,'day'),
(44,'day'),(45,'day'),(69,'day'),(70,'day'),(71,'day'),(172,'day'),
(25,'day'),(26,'day'),(52,'day'),(53,'day'),(54,'day'),(55,'day'),
(83,'day'),(84,'day'),(85,'day'),(58,'day'),(59,'day'),(179,'day'),
(180,'day'),(181,'day'),(187,'day'),(188,'day'),(189,'day'),
(191,'day'),(192,'day'),(193,'day'),(194,'day'),(283,'day'),
(284,'day'),(285,'day'),(406,'day'),(407,'day'),(408,'day'),
(415,'day'),(416,'day'),(417,'day'),(418,'day'),(420,'day'),
(421,'day'),(422,'day'),(423,'day')
ON CONFLICT (pokemon_id) DO UPDATE SET time_of_day = EXCLUDED.time_of_day;

SELECT
  COUNT(*) FILTER (WHERE time_of_day = 'day') AS diurnos,
  COUNT(*) FILTER (WHERE time_of_day = 'night') AS noturnos
FROM pokemon_spawn_time;