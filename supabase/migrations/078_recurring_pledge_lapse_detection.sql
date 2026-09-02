-- ============================================================
-- Detecção de compromisso recorrente que ficou "quieto" — recurring_pledges
-- (migration 031) só disparava lembrete por E-MAIL PRO PARCEIRO
-- (recurring-reminders cron), nunca verificava se a doação de fato
-- voltou a acontecer. `lapsed_notified_at` é a flag que o novo cron
-- `lapsed-donor-check` usa pra saber se já avisou o MISSIONÁRIO sobre
-- esse compromisso ter ficado quieto — liga quando cruza o limiar,
-- desliga sozinho quando uma nova `pledges` confirmada volta a aparecer
-- (o próprio cron recalcula do zero todo dia, não precisa de código em
-- nenhum outro lugar pra resetar isso).
-- ============================================================
ALTER TABLE public.recurring_pledges
  ADD COLUMN IF NOT EXISTS lapsed_notified_at TIMESTAMPTZ;
