-- ============================================================
-- Fundo restrito: além de `raised_amount` (já existia), a view passa a
-- devolver `spent_amount` (soma de `transactions.type='expense'` com esse
-- `budget_category_id`). Até aqui `budget_category_id` só era preenchido
-- pelo lado de receita (PledgeReviewCard, ao confirmar uma oferta) — o
-- formulário geral de lançamento passa a deixar marcar despesas também
-- (ver TransactionForm), então agora existe dado real de "gasto" pra
-- agregar. Mesmo padrão de DROP+CREATE já usado na migration 044 pra
-- acrescentar `description` a esta mesma view.
-- ============================================================
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
  COALESCE(SUM(t.amount) FILTER (WHERE t.type = 'income'), 0) AS raised_amount,
  COALESCE(SUM(t.amount) FILTER (WHERE t.type = 'expense'), 0) AS spent_amount
FROM project_budget_categories pbc
LEFT JOIN transactions t ON t.budget_category_id = pbc.id
GROUP BY pbc.id;
