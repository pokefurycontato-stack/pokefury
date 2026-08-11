-- Primeiro: ver as colunas da tabela city_npcs
SELECT column_name FROM information_schema.columns WHERE table_name = 'city_npcs';

-- Ver o conteudo da enfermeira
SELECT * FROM city_npcs WHERE id = '65460b65-d7fc-4f63-bed0-514c17a2f31c';
