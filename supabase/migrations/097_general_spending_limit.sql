-- ============================================================
-- Limite geral de gasto (modelo GranaZen, ver 7.36-bis) — teto mensal
-- único pro total de despesas do perfil, complementar aos limites por
-- categoria (`spending_limits`, migration 082). Uma linha por perfil
-- (UNIQUE profile_id — é configuração, não uma lista). `mode` escolhe
-- entre um valor manual (`manual_amount`) ou a soma automática dos
-- limites por categoria já cadastrados (calculada no cliente a partir de
-- `spending_limits`, mesma filosofia "calcula, não duplica" da 082 — sem
-- coluna própria pro total). `notify_threshold_pct` só muda a cor/rótulo
-- do status exibido (Dentro do limite/Atenção/Estourado) quando o gasto
-- cruza esse percentual — não dispara notificação nenhuma (sem
-- integração com o sistema de notificações nesta rodada, é aviso visual).
-- ============================================================
CREATE TABLE public.general_spending_limits (
  id                    UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  profile_id            UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL UNIQUE,
  created_by_user_id    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  enabled               BOOLEAN NOT NULL DEFAULT FALSE,
  mode                  TEXT NOT NULL DEFAULT 'sum_categories' CHECK (mode IN ('manual', 'sum_categories')),
  manual_amount         NUMERIC(15, 2),
  currency              TEXT NOT NULL DEFAULT 'BRL',
  notify_enabled        BOOLEAN NOT NULL DEFAULT TRUE,
  notify_threshold_pct  SMALLINT NOT NULL DEFAULT 100 CHECK (notify_threshold_pct BETWEEN 1 AND 100),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER general_spending_limits_updated_at BEFORE UPDATE ON general_spending_limits
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE public.general_spending_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "general_spending_limits_owner_all" ON general_spending_limits
  FOR ALL USING (is_profile_owner(profile_id));
