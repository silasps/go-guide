-- ============================================================
-- Lançamentos recorrentes (aluguel, assinaturas, mensalidades) — o lado
-- de despesa/receita pessoal que `recurring_pledges` (migration 031) não
-- cobre: aquela tabela é um compromisso de PARCEIRO com lembrete por
-- e-mail (nunca gera `transactions` sozinha, precisa confirmação humana ou
-- Stripe). Aqui é dinheiro do próprio missionário — não precisa de
-- confirmação de terceiro, só precisa criar o lançamento sozinho todo mês.
-- Schema deliberadamente enxuto (sem partner_id/highlight_id/budget_
-- category_id): caso de uso é conta fixa pessoal, não fundraising.
-- ============================================================
CREATE TABLE public.recurring_transactions (
  id                  UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  profile_id          UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  account_id          UUID REFERENCES financial_accounts(id) ON DELETE CASCADE NOT NULL,
  created_by_user_id  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  type                TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  amount              NUMERIC(15, 2) NOT NULL,
  currency            TEXT NOT NULL,
  description         TEXT NOT NULL,
  category_id         UUID REFERENCES transaction_categories(id) ON DELETE SET NULL,
  next_due_date       DATE NOT NULL,
  is_active           BOOLEAN NOT NULL DEFAULT true,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_recurring_transactions_profile_id ON recurring_transactions (profile_id);
CREATE INDEX idx_recurring_transactions_due ON recurring_transactions (next_due_date) WHERE is_active = true;

CREATE TRIGGER recurring_transactions_updated_at BEFORE UPDATE ON recurring_transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE public.recurring_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "recurring_transactions_owner_all" ON recurring_transactions
  FOR ALL USING (is_profile_owner(profile_id));

-- `transactions.source` ganha 'recurring' — diferencia na UI o que foi
-- gerado automaticamente do que foi digitado na hora, mesmo campo que já
-- existia (migration 001), só falta o valor.
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_source_check;
ALTER TABLE public.transactions ADD CONSTRAINT transactions_source_check
  CHECK (source IN ('manual', 'whatsapp', 'api', 'recurring'));
