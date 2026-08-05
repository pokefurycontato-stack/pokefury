-- ============================================================
-- DELETAR USUÁRIO DO AUTH POR E-mail
-- Use no SQL Editor do Supabase para limpar conta duplicada
-- ============================================================

-- Troque 'email_do_amigo@email.com' pelo e-mail real dele
-- Primeiro, encontre o ID do usuário:
SELECT id, email, created_at FROM auth.users WHERE email = 'email_do_amigo@email.com';

-- Se encontrar, delete o perfil e o auth user:
-- DESCOMENTE AS LINHAS ABAIXO depois de confirmar o ID:

-- DELETE FROM profiles WHERE id = (SELECT id FROM auth.users WHERE email = 'email_do_amigo@email.com');
-- DELETE FROM auth.users WHERE email = 'email_do_amigo@email.com';
