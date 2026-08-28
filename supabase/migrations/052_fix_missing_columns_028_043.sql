-- ============================================================
-- Diagnóstico automatizado (testando cada coluna de todas as
-- migrations via REST API com a service_role key) achou que as
-- migrations 028 e 043 nunca foram aplicadas no banco remoto —
-- causa real do "Erro ao registrar oferta" (pledges.budget_category_id
-- ausente). Reaplica as duas de forma idempotente.
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

ALTER TABLE pledges
  ADD COLUMN IF NOT EXISTS budget_category_id UUID REFERENCES project_budget_categories(id) ON DELETE SET NULL;

ALTER TABLE recurring_pledges
  ADD COLUMN IF NOT EXISTS budget_category_id UUID REFERENCES project_budget_categories(id) ON DELETE SET NULL;

NOTIFY pgrst, 'reload schema';
