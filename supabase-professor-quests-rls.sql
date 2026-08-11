-- Desabilitar RLS nas tabelas de quests (apenas admin usa)
ALTER TABLE city_professor_quests DISABLE ROW LEVEL SECURITY;
ALTER TABLE city_professor_quest_rewards DISABLE ROW LEVEL SECURITY;
ALTER TABLE player_professor_quests DISABLE ROW LEVEL SECURITY;
