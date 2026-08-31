-- "Arquivar" projeto — alternativa não destrutiva a excluir, a pedido do
-- usuário ("pra manter o histórico do que foi feito com este projeto").
-- Coluna separada de `status` (não um 4º valor do enum) de propósito: são
-- eixos independentes — um projeto arquivado guarda o `status` que tinha
-- (active/completed) pra, se restaurado, voltar exatamente como estava,
-- em vez de precisar reconciliar "estava ativo ou concluído?" depois.
ALTER TABLE public.highlights
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_highlights_archived_at ON highlights (profile_id) WHERE archived_at IS NOT NULL;
