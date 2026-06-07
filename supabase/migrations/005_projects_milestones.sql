-- ============================================================
-- FASE 2: Expandir highlights → Projetos + Marcos
-- ============================================================

-- Adicionar slug e partner_token à tabela highlights
ALTER TABLE public.highlights
  ADD COLUMN IF NOT EXISTS slug TEXT,
  ADD COLUMN IF NOT EXISTS goal_type TEXT NOT NULL DEFAULT 'financial' CHECK (goal_type IN ('financial', 'prayer', 'people', 'ongoing')),
  ADD COLUMN IF NOT EXISTS partner_token UUID DEFAULT uuid_generate_v4();

-- Índice único para slug por perfil
CREATE UNIQUE INDEX IF NOT EXISTS idx_highlights_profile_slug ON highlights (profile_id, slug) WHERE slug IS NOT NULL;

-- Índice único para partner_token
CREATE UNIQUE INDEX IF NOT EXISTS idx_highlights_partner_token ON highlights (partner_token);

-- Preencher slug para highlights existentes sem slug (baseado no título)
UPDATE public.highlights
SET slug = REGEXP_REPLACE(LOWER(title), '[^a-z0-9]+', '-', 'g')
WHERE slug IS NULL;

-- Vincular posts a projetos
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES highlights(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_posts_project_id ON posts (project_id) WHERE project_id IS NOT NULL;

-- ============================================================
-- MILESTONES (marcos do projeto)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.milestones (
  id           UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  highlight_id UUID REFERENCES highlights(id) ON DELETE CASCADE NOT NULL,
  profile_id   UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  title        TEXT NOT NULL,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  order_index  INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_milestones_highlight_id ON milestones (highlight_id);
CREATE INDEX IF NOT EXISTS idx_milestones_profile_id ON milestones (profile_id);

-- ============================================================
-- POST DELIVERIES (rastreamento de envio de relatórios de campo)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.post_deliveries (
  id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  post_id     UUID REFERENCES posts(id) ON DELETE CASCADE NOT NULL,
  partner_id  UUID REFERENCES partners(id) ON DELETE CASCADE NOT NULL,
  sent_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  opened_at   TIMESTAMPTZ,
  UNIQUE (post_id, partner_id)
);

CREATE INDEX IF NOT EXISTS idx_post_deliveries_post_id ON post_deliveries (post_id);
CREATE INDEX IF NOT EXISTS idx_post_deliveries_partner_id ON post_deliveries (partner_id);

-- RLS para novas tabelas
ALTER TABLE public.milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_deliveries ENABLE ROW LEVEL SECURITY;

-- Milestones: missionário gerencia os seus
CREATE POLICY "milestones_owner" ON public.milestones
  FOR ALL USING (
    profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

-- Milestones: leitura pública (para página do projeto)
CREATE POLICY "milestones_public_read" ON public.milestones
  FOR SELECT USING (
    profile_id IN (SELECT id FROM profiles WHERE privacy_mode = 'public')
  );

-- Post deliveries: apenas o dono do perfil
CREATE POLICY "post_deliveries_owner" ON public.post_deliveries
  FOR ALL USING (
    post_id IN (SELECT id FROM posts WHERE profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()))
  );

-- Trigger updated_at não se aplica (milestones não tem updated_at por design)
