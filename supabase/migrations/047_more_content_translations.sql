-- ============================================================
-- Estende o suporte a tradução de conteúdo (mesmo formato de
-- title_translations/description_translations da 042) para os
-- outros campos de texto livre do projeto que ainda só existiam
-- no idioma original: versículo, carta ("história por trás") e
-- título de cada marco.
-- ============================================================
ALTER TABLE highlights
  ADD COLUMN scripture_translations JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN letter_translations JSONB NOT NULL DEFAULT '{}';

ALTER TABLE milestones
  ADD COLUMN title_translations JSONB NOT NULL DEFAULT '{}';
