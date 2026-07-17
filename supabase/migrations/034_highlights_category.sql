-- Taxonomia de assunto/categoria do projeto, ortogonal a goal_type (que
-- descreve o tipo de apoio pedido, não o assunto). Sinal de afinidade para
-- o ranking do feed. Sem CHECK de valores, mesma convenção de goal_type
-- (validação só em TypeScript, para não exigir migration a cada categoria nova).
ALTER TABLE highlights ADD COLUMN category TEXT[] DEFAULT ARRAY[]::TEXT[];
