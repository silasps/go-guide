-- ============================================================
-- Fase 1 de "campanhas pra parceiros" (a pedido do usuário): motor de
-- envio de atualização avulsa pra rede de parceiros. Base reaproveitada
-- depois pela Fase 2 (campanha automática vinculada a highlights.funding_
-- deadline, ainda não implementada nesta migration).
--
-- partner_broadcasts = o envio em si (assunto, corpo, filtro de
-- destinatário escolhido). partner_broadcast_recipients = fila de
-- destinatários, 1 linha por parceiro, drenada em lotes pelo cron
-- `broadcast-sender` — mesmo padrão do `notification-emails` (068):
-- marca sent_at mesmo em falha (sem retry infinito), guarda o erro real
-- pra debug em vez de silenciar.
-- ============================================================
CREATE TABLE public.partner_broadcasts (
  id                UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  profile_id        UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  sender_user_id    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  subject           TEXT NOT NULL,
  body              TEXT NOT NULL,
  recipient_filter  TEXT NOT NULL DEFAULT 'all' CHECK (recipient_filter IN ('all', 'financial', 'prayer', 'both', 'ambassador')),
  recipient_count   INTEGER NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.partner_broadcast_recipients (
  id            UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  broadcast_id  UUID REFERENCES partner_broadcasts(id) ON DELETE CASCADE NOT NULL,
  partner_id    UUID REFERENCES partners(id) ON DELETE CASCADE NOT NULL,
  email         TEXT NOT NULL,
  sent_at       TIMESTAMPTZ,
  error         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_partner_broadcast_recipients_broadcast ON partner_broadcast_recipients (broadcast_id);
-- A query do cron sempre filtra sent_at IS NULL — índice parcial cobre
-- exatamente esse caso sem indexar as linhas já processadas.
CREATE INDEX idx_partner_broadcast_recipients_pending ON partner_broadcast_recipients (created_at) WHERE sent_at IS NULL;

ALTER TABLE public.partner_broadcasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_broadcast_recipients ENABLE ROW LEVEL SECURITY;

-- Só o dono do perfil (ou gestor vinculado, is_profile_owner cobre os dois)
-- cria/lê seus próprios broadcasts. O cron usa createServiceClient()
-- (bypassa RLS) pra marcar sent_at/error, então não precisa de policy de
-- UPDATE aqui — só INSERT (compor) e SELECT (ver histórico/status) via
-- client normal, cobertos pelo FOR ALL.
CREATE POLICY "partner_broadcasts_owner_all" ON partner_broadcasts
  FOR ALL USING (is_profile_owner(profile_id));

CREATE POLICY "partner_broadcast_recipients_owner_all" ON partner_broadcast_recipients
  FOR ALL USING (
    EXISTS (SELECT 1 FROM partner_broadcasts b WHERE b.id = partner_broadcast_recipients.broadcast_id AND is_profile_owner(b.profile_id))
  );
