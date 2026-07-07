-- ============================================================
-- Cartão de crédito: fechamento/vencimento de fatura, bandeira e
-- arquivamento de conta; fatura_date/fatura_paid nos lançamentos.
-- Reaproveitado do modelo validado no projeto GranaZen (branch
-- master, histórico não relacionado a este repo).
-- ============================================================
ALTER TABLE financial_accounts
  ADD COLUMN IF NOT EXISTS closing_day SMALLINT CHECK (closing_day BETWEEN 1 AND 31),
  ADD COLUMN IF NOT EXISTS due_day SMALLINT CHECK (due_day BETWEEN 1 AND 31),
  ADD COLUMN IF NOT EXISTS card_brand TEXT,
  ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS fatura_date DATE,
  ADD COLUMN IF NOT EXISTS fatura_paid BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_transactions_fatura ON transactions (account_id, fatura_date) WHERE fatura_date IS NOT NULL;
