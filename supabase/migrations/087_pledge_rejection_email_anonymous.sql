-- ============================================================
-- E-mail de "oferta não confirmada" pra quem reportou SEM conta
-- (reporter_user_id NULL, típico de doação avulsa sem login) mas deixou
-- e-mail no formulário (reporter_email preenchido, PledgeForm) — o
-- caminho normal (trg_notify_pledge_rejected, migration 085) só alcança
-- quem tem conta, porque passa pela tabela `notifications`
-- (recipient_user_id NOT NULL, ver notify() na migration 014). Esse é o
-- complemento: cron varre `pledges` direto, sem depender de auth.users.
-- Quem escolheu doação anônima (is_anonymous=true) já tem reporter_email
-- NULL desde o insert (PledgeForm), então o filtro abaixo já respeita
-- essa escolha sem checagem extra.
-- ============================================================
ALTER TABLE public.pledges ADD COLUMN IF NOT EXISTS rejection_email_sent_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_pledges_pending_rejection_email
  ON pledges (reviewed_at)
  WHERE status = 'rejected' AND reporter_user_id IS NULL AND reporter_email IS NOT NULL AND rejection_email_sent_at IS NULL;
