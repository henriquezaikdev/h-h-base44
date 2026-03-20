-- Seed inicial: primeiro usuário da empresa H&H
-- auth_user_id será vinculado após criar o usuário no Supabase Auth (Authentication > Users)

INSERT INTO sellers (
  auth_user_id,
  company_id,
  name,
  email,
  role,
  department,
  active
) VALUES (
  NULL,
  '00000000-0000-0000-0000-000000000001',
  'Henrique',
  'henrique@hhcomercio.com',
  'owner',
  'gestao',
  true
);

-- Após criar o usuário no Supabase Auth, vincule com:
-- UPDATE sellers
-- SET auth_user_id = '<uuid-do-auth-user>'
-- WHERE email = 'henrique@hhcomercio.com';
