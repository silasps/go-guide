-- ============================================================
-- Título/descrição de projeto passam a suportar tradução, igual a
-- posts (original_locale + translations) e à bio do perfil
-- (bio_locale + bio_translations) — mesma forma de content translation,
-- só em duas colunas (título e descrição são campos separados).
-- ============================================================
ALTER TABLE highlights
  ADD COLUMN original_locale TEXT NOT NULL DEFAULT 'pt' CHECK (original_locale IN ('pt', 'en', 'es')),
  ADD COLUMN title_translations JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN description_translations JSONB NOT NULL DEFAULT '{}';
