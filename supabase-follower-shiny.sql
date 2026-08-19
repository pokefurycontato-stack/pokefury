-- Flag explicita de "pokemon shiny" no pokemon de seguir (follower) dos jogadores.
-- Necessaria para os OTHER jogadores verem o efeito de brilho/estrelinhas acima
-- do follower shiny de um jogador, de forma confiavel (sem depender da URL).
ALTER TABLE public.city_players
  ADD COLUMN IF NOT EXISTS follower_is_shiny boolean;

-- A tabela city_players ja deve estar na publicacao realtime (posicoes ja sincronizam).
-- Se por algum motivo nao estiver, rode:
-- alter publication supabase_realtime add table public.city_players;