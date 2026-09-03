-- ============================================================
-- Metas de economia (modelo GranaZen, ver 7.20) — valor alvo com progresso
-- e prazo opcional. Deliberadamente SEM vínculo automático com contas ou
-- `transactions` na v1 (confirmado com o usuário): `current_amount` é
-- atualizado manualmente (editar a meta ou "Registrar valor", que soma um
-- aporte). Vincular automático a uma conta/categoria exigiria decidir regra
-- de atribuição (qual dinheiro conta pra qual meta quando há several metas
-- e uma conta só) — fora de escopo até haver um caso de uso real pedindo.
-- ============================================================
CREATE TABLE public.financial_goals (
  id                  UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  profile_id          UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  created_by_user_id  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name                TEXT NOT NULL,
  target_amount       NUMERIC(15, 2) NOT NULL,
  current_amount      NUMERIC(15, 2) NOT NULL DEFAULT 0,
  currency            TEXT NOT NULL,
  target_date         DATE,
  achieved_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_financial_goals_profile_id ON financial_goals (profile_id);

CREATE TRIGGER financial_goals_updated_at BEFORE UPDATE ON financial_goals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE public.financial_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "financial_goals_owner_all" ON financial_goals
  FOR ALL USING (is_profile_owner(profile_id));
