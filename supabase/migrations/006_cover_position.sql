ALTER TABLE public.highlights
  ADD COLUMN IF NOT EXISTS cover_position TEXT NOT NULL DEFAULT '50% 50%';
