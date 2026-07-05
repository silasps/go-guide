-- ============================================================
-- Equipe dentro de um projeto (ex.: tempo prático em grupo)
-- ============================================================
CREATE TABLE public.project_members (
  id                 UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  highlight_id       UUID REFERENCES highlights(id) ON DELETE CASCADE NOT NULL,
  user_id            UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role               TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('lead', 'member', 'viewer')),
  invited_by_user_id UUID REFERENCES auth.users(id),
  joined_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (highlight_id, user_id)
);

CREATE INDEX idx_project_members_highlight_id ON project_members (highlight_id);
CREATE INDEX idx_project_members_user_id ON project_members (user_id);

ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "project_members_owner_manage" ON project_members
  FOR ALL USING (
    highlight_id IN (SELECT id FROM highlights WHERE is_profile_owner(profile_id))
  );

-- Um membro da equipe pode ver os demais membros do mesmo projeto
-- (não só a própria linha), para exibir o painel de equipe.
CREATE POLICY "project_members_team_read" ON project_members
  FOR SELECT USING (
    auth.uid() = user_id
    OR highlight_id IN (SELECT pm.highlight_id FROM project_members pm WHERE pm.user_id = auth.uid())
  );

-- ============================================================
-- Financeiro compartilhado do projeto — reaproveita financial_accounts
-- (com highlight_id) em vez de criar um conceito paralelo de "conta
-- do projeto". account_members controla quem mexe no dinheiro;
-- project_members controla quem edita o conteúdo do projeto.
-- ============================================================
ALTER TABLE public.financial_accounts
  ADD COLUMN IF NOT EXISTS highlight_id UUID REFERENCES highlights(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_financial_accounts_highlight_id ON financial_accounts (highlight_id) WHERE highlight_id IS NOT NULL;
