-- ============================================================
-- Descrição opcional por categoria de orçamento (ex.: "O que inclui"),
-- além do título/label já existente — usado em projetos com etapas
-- detalhadas (ex.: construção) onde cada categoria precisa de um
-- resumo do que está contemplado, não só o valor.
-- ============================================================
ALTER TABLE public.project_budget_categories
  ADD COLUMN IF NOT EXISTS description TEXT;

DROP VIEW IF EXISTS project_budget_progress;

CREATE VIEW project_budget_progress WITH (security_invoker = true) AS
SELECT
  pbc.id,
  pbc.highlight_id,
  pbc.category_type,
  pbc.custom_label,
  pbc.description,
  pbc.target_amount,
  pbc.order_index,
  COALESCE(SUM(t.amount) FILTER (WHERE t.type = 'income'), 0) AS raised_amount
FROM project_budget_categories pbc
LEFT JOIN transactions t ON t.budget_category_id = pbc.id
GROUP BY pbc.id;
