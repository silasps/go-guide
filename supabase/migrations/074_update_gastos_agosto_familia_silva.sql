-- ============================================================
-- Atualiza as categorias de orçamento do projeto "Gastos de Agosto —
-- Família Silva" pros valores reais informados pelo usuário, substituindo
-- por completo a lista anterior.
-- ============================================================
DELETE FROM project_budget_categories
WHERE highlight_id = 'af680ea0-ff4c-49aa-b875-2f42744efc17';

INSERT INTO project_budget_categories (highlight_id, category_type, custom_label, target_amount, order_index)
VALUES
  ('af680ea0-ff4c-49aa-b875-2f42744efc17', 'other', '🍽️ Alimentação', 2527.05, 0),
  ('af680ea0-ff4c-49aa-b875-2f42744efc17', 'other', '🩺 Saúde', 1426.72, 1),
  ('af680ea0-ff4c-49aa-b875-2f42744efc17', 'other', '🏠 Aluguel', 848.00, 2),
  ('af680ea0-ff4c-49aa-b875-2f42744efc17', 'other', '🏢 Condomínio', 289.29, 3),
  ('af680ea0-ff4c-49aa-b875-2f42744efc17', 'other', '💡 Energia', 140.17, 4),
  ('af680ea0-ff4c-49aa-b875-2f42744efc17', 'other', '🔧 Manutenção da casa', 132.52, 5),
  ('af680ea0-ff4c-49aa-b875-2f42744efc17', 'other', '⛽ Combustível — rotina', 95.52, 6),
  ('af680ea0-ff4c-49aa-b875-2f42744efc17', 'other', '🚗 Manutenção do carro', 13.99, 7),
  ('af680ea0-ff4c-49aa-b875-2f42744efc17', 'other', '🛡️ Seguro do carro', 155.00, 8),
  ('af680ea0-ff4c-49aa-b875-2f42744efc17', 'other', '🏋️ Academia', 202.55, 9),
  ('af680ea0-ff4c-49aa-b875-2f42744efc17', 'other', '📺 Netflix', 44.90, 10),
  ('af680ea0-ff4c-49aa-b875-2f42744efc17', 'other', '🧳 Custo extra de viagem à MG', 767.06, 11);

-- goal_amount reflete a soma das categorias (mesmo padrão já usado nesse
-- projeto: 5286.08 batia exatamente com a soma das categorias antigas).
UPDATE highlights
SET goal_amount = 6642.77
WHERE id = 'af680ea0-ff4c-49aa-b875-2f42744efc17';
