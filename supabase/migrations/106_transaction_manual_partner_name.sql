-- ============================================================
-- Nome de parceiro digitado à mão no lançamento, pra quando quem mandou a
-- oferta não está cadastrado como parceiro no sistema (nem vai ser) — só
-- pra registro/lembrete de quem foi. Pedido do usuário: "o usuário deve
-- ter a opção de colocar um nome manualmente pra ficar registrado e ele
-- lembrar quem foi".
--
-- Deliberadamente uma coluna solta (TEXT, sem FK) em vez de forçar cadastro
-- de parceiro pra esse caso — mesma filosofia de `pledges.reporter_name`
-- (migration 012), que já guarda nome como texto livre independente de
-- `partner_id`. Mutuamente exclusivo com `partner_id` na prática (decidido
-- na UI do `TransactionForm`, não com CHECK constraint — um CHECK
-- "só um dos dois" adicionaria fragilidade sem benefício real aqui).
-- ============================================================

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS manual_partner_name TEXT;
