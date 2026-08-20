-- CORREÇÃO: impedir que remover/recriar o NPC do professor apague as quests em cascata.
--
-- Antes, city_professor_quests.npc_id tinha "ON DELETE CASCADE": quando o salvar do mapa
-- apagava a linha do professor (ou o professor era removido), as quests eram apagadas junto.
-- Com ON DELETE SET NULL, ao remover o NPC as quests ficam órfãs (npc_id = null) e o app
-- re-vincula elas ao próximo professor colocado (re-link feito no city-builder).
--
-- Rodar uma única vez no SQL Editor do Supabase.

-- 1) Descarta a FK antiga (cascade)
ALTER TABLE public.city_professor_quests
  DROP CONSTRAINT IF EXISTS city_professor_quests_npc_id_fkey;

-- 2) Recria a FK sem apagar as quests quando o NPC for removido
ALTER TABLE public.city_professor_quests
  ADD CONSTRAINT city_professor_quests_npc_id_fkey
  FOREIGN KEY (npc_id) REFERENCES public.city_npcs(id) ON DELETE SET NULL;

-- 3) (Opcional) Diagnóstico: ver se existem quests órfãs (npc já removido) para re-vincular
-- SELECT q.id, q.title, q.npc_id
-- FROM public.city_professor_quests q
-- WHERE q.npc_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.city_npcs n WHERE n.id = q.npc_id);