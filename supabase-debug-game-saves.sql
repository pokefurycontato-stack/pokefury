-- Diagnóstico: ver todas as constraints e índices da game_saves
SELECT conname, contype, pg_get_constraintdef(oid) as def
FROM pg_constraint WHERE conrelid = 'game_saves'::regclass;

SELECT indexname, indexdef
FROM pg_indexes WHERE tablename = 'game_saves';

SELECT tgname, tgenabled FROM pg_trigger
WHERE tgrelid = 'game_saves'::regclass AND NOT tgisinternal;
