-- goal_type vira array para suportar múltiplos tipos de apoio
ALTER TABLE public.highlights
  DROP CONSTRAINT IF EXISTS highlights_goal_type_check;

ALTER TABLE public.highlights
  ALTER COLUMN goal_type TYPE TEXT[]
  USING ARRAY[goal_type];

ALTER TABLE public.highlights
  ALTER COLUMN goal_type SET DEFAULT ARRAY['financial'];

-- Adicionar 'ambassador' ao tipo de parceiro
ALTER TABLE public.partners
  DROP CONSTRAINT IF EXISTS partners_type_check;

ALTER TABLE public.partners
  ADD CONSTRAINT partners_type_check
    CHECK (type IN ('financial', 'prayer', 'both', 'ambassador'));
