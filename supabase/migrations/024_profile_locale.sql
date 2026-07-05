-- ============================================================
-- Idioma preferido do usuário (i18n PT/EN/ES). Usado por
-- src/i18n/request.ts para resolver o locale de usuários logados
-- quando não há cookie NEXT_LOCALE explícito (ex: primeiro acesso
-- em um novo dispositivo).
-- ============================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS locale TEXT NOT NULL DEFAULT 'pt' CHECK (locale IN ('pt', 'en', 'es'));
