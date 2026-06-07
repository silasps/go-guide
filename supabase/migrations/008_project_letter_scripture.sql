ALTER TABLE public.highlights
  ADD COLUMN IF NOT EXISTS scripture  TEXT,
  ADD COLUMN IF NOT EXISTS letter     TEXT;

-- Adicionar status 'completed' (projetos concluídos visíveis no histórico)
ALTER TABLE public.highlights
  DROP CONSTRAINT IF EXISTS highlights_status_check;

ALTER TABLE public.highlights
  ADD CONSTRAINT highlights_status_check
    CHECK (status IN ('active', 'hidden', 'completed'));
