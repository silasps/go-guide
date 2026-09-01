-- Reverte o grandfathering da migration 063 para contas reais de e-mail/senha
-- — a pedido do usuário, agora que a Brevo está configurada de verdade,
-- toda conta (não só as criadas a partir de agora) deve confirmar o e-mail.
--
-- Exclui de propósito os domínios de teste/seed (@seed.goguide.test,
-- @goguide.dev) usados por scripts/seed-test-accounts.mjs: são e-mails que
-- não existem de verdade, então forçar verificação neles travaria essas
-- contas pra sempre, sem ninguém pra clicar no link.
update profiles p
set email_verified = false
from auth.users u
where p.user_id = u.id
  and coalesce(u.raw_app_meta_data->>'provider', 'email') = 'email'
  and u.email not like '%@seed.goguide.test'
  and u.email not like '%@goguide.dev';
