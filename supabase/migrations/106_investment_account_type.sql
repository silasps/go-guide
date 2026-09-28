-- Tipo de conta "Investimento" (ver system.architecture.md 7.29/Changelog) —
-- a pedido do usuário, contas de investimento passaram a ficar de fora do
-- "saldo disponível" somado na Visão Geral e na tela de Contas (mistura
-- dinheiro do dia a dia com patrimônio investido, o que não faz sentido pra
-- decidir quanto dá pra gastar). O saldo da própria conta (`balance`)
-- continua funcionando normalmente — é só excluída das somas de "saldo
-- total"/"saldo disponível", igual já acontecia com `credit`.
ALTER TABLE public.financial_accounts DROP CONSTRAINT IF EXISTS financial_accounts_account_type_check;
ALTER TABLE public.financial_accounts ADD CONSTRAINT financial_accounts_account_type_check
  CHECK (account_type IN ('checking', 'savings', 'credit', 'investment'));
