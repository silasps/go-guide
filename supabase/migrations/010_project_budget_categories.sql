-- ============================================================
-- Metas financeiras por categoria dentro de um projeto/desafio
-- ============================================================
CREATE TABLE public.project_budget_categories (
  id             UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  highlight_id   UUID REFERENCES highlights(id) ON DELETE CASCADE NOT NULL,
  category_type  TEXT NOT NULL CHECK (category_type IN (
                    'airfare', 'bus', 'boat', 'ferry', 'rideshare', 'lodging',
                    'food', 'equipment', 'visa_documentation', 'insurance',
                    'training', 'shipping', 'other'
                  )),
  custom_label   TEXT,
  target_amount  NUMERIC(15, 2) NOT NULL,
  order_index    INTEGER NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_project_budget_categories_highlight_id ON project_budget_categories (highlight_id);

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS budget_category_id UUID REFERENCES project_budget_categories(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_budget_category_id ON transactions (budget_category_id) WHERE budget_category_id IS NOT NULL;

-- View: total arrecadado por categoria de orçamento (soma de transações de income vinculadas)
-- security_invoker garante que a RLS das tabelas base seja aplicada com base em quem consulta a view,
-- não com base no dono da view (evita vazar dados de transações via a view).
CREATE VIEW project_budget_progress WITH (security_invoker = true) AS
SELECT
  pbc.id,
  pbc.highlight_id,
  pbc.category_type,
  pbc.custom_label,
  pbc.target_amount,
  pbc.order_index,
  COALESCE(SUM(t.amount) FILTER (WHERE t.type = 'income'), 0) AS raised_amount
FROM project_budget_categories pbc
LEFT JOIN transactions t ON t.budget_category_id = pbc.id
GROUP BY pbc.id;

ALTER TABLE public.project_budget_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "project_budget_categories_owner_all" ON project_budget_categories
  FOR ALL USING (
    highlight_id IN (SELECT id FROM highlights WHERE is_profile_owner(profile_id))
  );

CREATE POLICY "project_budget_categories_public_read" ON project_budget_categories
  FOR SELECT USING (
    highlight_id IN (SELECT id FROM highlights WHERE status = 'active')
  );
