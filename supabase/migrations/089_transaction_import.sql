-- ============================================================
-- Importação de extrato (OFX) — alternativa gratuita ao Open Finance
-- (seção 7.32/7.33 do system.architecture.md): Pluggy tem custo inviável
-- nesta fase do produto, então em vez de sincronização automática em tempo
-- real, o usuário baixa o extrato do próprio internet banking (toda
-- instituição brasileira oferece exportação OFX) e sobe o arquivo — sem
-- nenhuma API paga envolvida.
--
-- `import_uid` guarda o FITID do OFX (identificador único que o próprio
-- banco atribui a cada lançamento) — dedup entre importações repetidas do
-- mesmo período. Único por conta (o mesmo FITID pode se repetir entre
-- contas de bancos diferentes).
-- ============================================================
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS import_uid TEXT;

ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_account_import_uid_key;
ALTER TABLE public.transactions ADD CONSTRAINT transactions_account_import_uid_key UNIQUE (account_id, import_uid);

ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_source_check;
ALTER TABLE public.transactions ADD CONSTRAINT transactions_source_check
  CHECK (source IN ('manual', 'whatsapp', 'api', 'recurring', 'open_finance', 'import'));
