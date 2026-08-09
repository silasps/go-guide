-- ============================================================
-- Permite ao apoiador escolher, no momento da contribuição, uma
-- categoria específica do orçamento detalhado do projeto (ex.: "fundação",
-- "telhado") em vez de só o projeto geral. NULL = projeto geral, mesma
-- semântica que highlight_id IS NULL já usa pra "doação livre".
-- ============================================================
ALTER TABLE pledges
  ADD COLUMN budget_category_id UUID REFERENCES project_budget_categories(id) ON DELETE SET NULL;

ALTER TABLE recurring_pledges
  ADD COLUMN budget_category_id UUID REFERENCES project_budget_categories(id) ON DELETE SET NULL;
