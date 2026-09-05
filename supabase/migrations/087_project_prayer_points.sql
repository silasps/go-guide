-- ============================================================
-- Pontos de oração por projeto — equivalente pro lado de oração do que
-- project_budget_categories já é pro lado financeiro: itens específicos
-- que o missionário cadastra ("Proteção da equipe", "Abertura de portas
-- com a liderança local" etc.), opcionalmente vinculados a uma necessidade
-- financeira (budget_category_id), pra que a pessoa possa orar por um
-- ponto específico ou pelo projeto todo — sem exigir meta financeira
-- nenhuma (projetos podem ser só de oração).
-- ============================================================
CREATE TABLE public.project_prayer_points (
  id                  UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  highlight_id        UUID REFERENCES public.highlights(id) ON DELETE CASCADE NOT NULL,
  budget_category_id  UUID REFERENCES public.project_budget_categories(id) ON DELETE SET NULL,
  title               TEXT NOT NULL,
  description         TEXT,
  prayer_count        INTEGER NOT NULL DEFAULT 0,
  is_completed        BOOLEAN NOT NULL DEFAULT false,
  completed_at        TIMESTAMPTZ,
  order_index         INTEGER NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_project_prayer_points_highlight_id ON public.project_prayer_points (highlight_id);

ALTER TABLE public.project_prayer_points ENABLE ROW LEVEL SECURITY;

-- Mesmo padrão de project_budget_categories (migration 010): dono do
-- perfil enxerga/edita tudo, leitura pública só quando o projeto está ativo.
CREATE POLICY "project_prayer_points_owner_all" ON public.project_prayer_points
  FOR ALL USING (highlight_id IN (SELECT id FROM public.highlights WHERE is_profile_owner(profile_id)));

CREATE POLICY "project_prayer_points_public_read" ON public.project_prayer_points
  FOR SELECT USING (highlight_id IN (SELECT id FROM public.highlights WHERE status = 'active'));

-- Uma oração pode ser sobre o missionário em geral (como já era), sobre um
-- projeto como um todo (highlight_id preenchido, prayer_point_id nulo —
-- "orar por tudo"), ou sobre um ponto específico (os dois preenchidos).
ALTER TABLE public.prayer_requests
  ADD COLUMN highlight_id UUID REFERENCES public.highlights(id) ON DELETE SET NULL,
  ADD COLUMN prayer_point_id UUID REFERENCES public.project_prayer_points(id) ON DELETE SET NULL;

-- prayer_count é público (via project_prayer_points, RLS acima), mas o
-- conteúdo de prayer_requests não é (só dono do perfil/parceiros
-- autorizados leem, é potencialmente E2EE) — um visitante não pode contar
-- linhas ali diretamente. O contador fica denormalizado e é mantido por
-- trigger, mesmo padrão de highlights.current_amount.
CREATE OR REPLACE FUNCTION increment_prayer_point_count()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.prayer_point_id IS NOT NULL THEN
    UPDATE public.project_prayer_points SET prayer_count = prayer_count + 1 WHERE id = NEW.prayer_point_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_increment_prayer_point_count
  AFTER INSERT ON public.prayer_requests
  FOR EACH ROW EXECUTE FUNCTION increment_prayer_point_count();
