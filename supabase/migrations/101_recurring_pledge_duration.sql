-- ============================================================
-- Compromisso de duração fixa ("parceiro por 3 meses") — hoje toda
-- recurring_pledges (migration 031) é indefinida até cancelamento manual.
-- `duration_months` nulo preserva 100% o comportamento atual (sem prazo).
-- `cycles_completed` conta ciclos já cobrados (Stripe, via
-- invoice.payment_succeeded) ou já lembrados (manual/Pix, via o próprio
-- disparo do cron de lembrete — não há como confirmar automaticamente um
-- Pix, então aqui "ciclo" = "lembrete enviado").
-- ============================================================
ALTER TABLE public.recurring_pledges
  ADD COLUMN duration_months  INTEGER CHECK (duration_months IS NULL OR duration_months > 0),
  ADD COLUMN cycles_completed INTEGER NOT NULL DEFAULT 0 CHECK (cycles_completed >= 0),
  ADD COLUMN completed_at     TIMESTAMPTZ,
  -- Timestamp exato mandado pro Stripe como `subscription_data.cancel_at`
  -- na criação — o webhook compara com `subscription.canceled_at` em
  -- customer.subscription.deleted pra saber se a assinatura terminou
  -- sozinha (bateu com essa data) ou foi cancelada antes (não bateu).
  ADD COLUMN stripe_cancel_at TIMESTAMPTZ,
  -- Guarda o `next_reminder_at` (valor ANTES do avanço) do ciclo em que o
  -- e-mail de sugestão de WhatsApp pro missionário já foi mandado — evita
  -- duplicar se o cron reprocessar a mesma linha no mesmo dia.
  ADD COLUMN missionary_nudge_sent_for_date DATE;

-- 'completed' é um estado terminal novo, distinto de 'cancelled': o
-- compromisso cumpriu o prazo combinado sozinho, ninguém cancelou antes.
ALTER TABLE public.recurring_pledges DROP CONSTRAINT recurring_pledges_status_check;
ALTER TABLE public.recurring_pledges ADD CONSTRAINT recurring_pledges_status_check
  CHECK (status IN ('pending', 'active', 'paused', 'cancelled', 'completed'));

COMMENT ON COLUMN public.recurring_pledges.duration_months IS
  'NULL = sem prazo definido (comportamento legado). N = compromisso encerra sozinho após N ciclos.';
COMMENT ON COLUMN public.recurring_pledges.cycles_completed IS
  'Nº de ciclos já cobrados (Stripe) ou já lembrados (manual/Pix).';
