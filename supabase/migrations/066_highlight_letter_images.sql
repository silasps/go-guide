-- ============================================================
-- Até duas imagens opcionais intercaladas no texto da "carta"/história do
-- projeto (highlights.letter) — mesmo padrão já usado nas seções
-- who_we_are/our_calling da história do perfil (migration 055/056), pra
-- não ficar um texto corrido sem nenhuma imagem no meio.
-- ============================================================
ALTER TABLE public.highlights
  ADD COLUMN IF NOT EXISTS letter_image_url TEXT,
  ADD COLUMN IF NOT EXISTS letter_image_caption TEXT,
  ADD COLUMN IF NOT EXISTS letter_image_url_2 TEXT,
  ADD COLUMN IF NOT EXISTS letter_image_caption_2 TEXT;
