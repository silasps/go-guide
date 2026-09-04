-- ============================================================
-- Limites de gastos por categoria (modelo GranaZen, ver 7.20) — teto
-- mensal de despesa por categoria de topo, com aviso visual quando estoura.
-- Só mensal (sem período configurável), mesma decisão de escopo de
-- `recurring_transactions` (migration 077, só frequência mensal). Um limite
-- por categoria (UNIQUE) — evita dois limites ambíguos pra mesma categoria.
-- Gasto realizado é calculado no cliente a partir de `transactions`
-- existentes (soma de `type='expense'` do mês corrente por categoria,
-- pago+não pago juntos — mesma soma que a aba "Despesas" do navegador de
-- mês, ver 7.19), sem tabela/coluna própria de "gasto acumulado".
-- ============================================================
CREATE TABLE public.spending_limits (
  id                  UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  profile_id          UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  category_id         UUID REFERENCES transaction_categories(id) ON DELETE CASCADE NOT NULL,
  created_by_user_id  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  limit_amount        NUMERIC(15, 2) NOT NULL,
  currency            TEXT NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (profile_id, category_id)
);

CREATE INDEX idx_spending_limits_profile_id ON spending_limits (profile_id);

CREATE TRIGGER spending_limits_updated_at BEFORE UPDATE ON spending_limits
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE public.spending_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "spending_limits_owner_all" ON spending_limits
  FOR ALL USING (is_profile_owner(profile_id));
