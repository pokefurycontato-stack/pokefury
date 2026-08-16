-- Pokemon seguindo na cidade (visivel para todos em tempo real)
-- Colunas extras em city_players para propagar o follower do jogador.
ALTER TABLE public.city_players
  ADD COLUMN IF NOT EXISTS follower_id bigint,
  ADD COLUMN IF NOT EXISTS follower_sprite_url text,
  ADD COLUMN IF NOT EXISTS follower_back_url text,
  ADD COLUMN IF NOT EXISTS follower_scale real;

-- city_players ja deve estar na publicacao realtime (as posicoes ja sincronizam).
-- Se nao estiver, descomente:
-- alter publication supabase_realtime add table public.city_players;