-- ============================================================
-- Estende o suporte a tradução (mesmo formato de title_translations
-- das outras tabelas, ver 042/047) para os pontos de oração —
-- título e descrição, os dois campos de texto livre da tabela.
-- ============================================================
ALTER TABLE project_prayer_points
  ADD COLUMN IF NOT EXISTS title_translations JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS description_translations JSONB NOT NULL DEFAULT '{}';

NOTIFY pgrst, 'reload schema';
