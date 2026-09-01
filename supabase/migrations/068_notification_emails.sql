-- ============================================================
-- E-mail para notificações selecionadas (new_message, pledge_confirmed,
-- new_pledge, new_partner) — cron a cada 5min varrendo `notifications`
-- com email_sent_at IS NULL, mesmo padrão do cron prayer-partner-updates
-- (marca depois de tentar, sem retry infinito em caso de falha).
-- ============================================================
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS email_sent_at TIMESTAMPTZ;

-- Índice parcial: a query do cron sempre filtra por email_sent_at IS NULL
-- + type IN (...), então cobre exatamente o caso de uso sem indexar as
-- linhas já processadas (a grande maioria, com o tempo).
CREATE INDEX IF NOT EXISTS idx_notifications_pending_email
  ON notifications (created_at)
  WHERE email_sent_at IS NULL;
