-- E-mail automático de "obrigado por orar / veja as novidades" pros parceiros
-- de oração (type IN ('prayer','both')) quando o missionário publica algo
-- novo (post ou projeto) — pedido do usuário. Cron diário (ver
-- src/app/api/cron/prayer-partner-updates/route.ts) usa essas duas colunas
-- pra saber quem já foi avisado e até quando, e pra dar opção de sair.
ALTER TABLE public.partners
  ADD COLUMN IF NOT EXISTS last_update_email_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS update_emails_opt_in BOOLEAN NOT NULL DEFAULT true;
