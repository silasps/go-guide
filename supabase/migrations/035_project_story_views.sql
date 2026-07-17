-- Rastreio de "visto/não visto" pra faixa de stories de projetos seguidos no
-- feed (círculo com anel destacado quando há atualização nova) — mesmo
-- padrão de RLS de `follows` (migration 033): só o próprio usuário
-- lê/escreve sua marcação de visualização.
CREATE TABLE project_story_views (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  highlight_id UUID NOT NULL REFERENCES highlights(id) ON DELETE CASCADE,
  last_viewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, highlight_id)
);

CREATE INDEX idx_project_story_views_user ON project_story_views(user_id);
CREATE INDEX idx_project_story_views_highlight ON project_story_views(highlight_id);

ALTER TABLE project_story_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "project_story_views_self_insert" ON project_story_views
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "project_story_views_self_read" ON project_story_views
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "project_story_views_self_update" ON project_story_views
  FOR UPDATE USING (auth.uid() = user_id);
