-- ============================================================
-- STRIPE CONNECT (recebimento automático) + RECORRÊNCIA de verdade
-- na página pública de parceria (compromisso + lembrete manual, ou
-- assinatura automática quando o missionário tem Stripe conectado).
-- ============================================================

-- payment_methods: 'stripe' entra no catálogo de tipos, e ganha um
-- vínculo opcional com a conta financeira que recebe os depósitos
-- automáticos confirmados pelo webhook.
ALTER TABLE payment_methods DROP CONSTRAINT payment_methods_type_check;
ALTER TABLE payment_methods ADD CONSTRAINT payment_methods_type_check CHECK (type IN (
  'pix', 'mercadopago', 'paypal', 'wise', 'bank_transfer', 'revolut',
  'zelle', 'venmo', 'cashapp', 'alipay', 'wechatpay', 'mpesa', 'crypto', 'other', 'stripe'
));
ALTER TABLE payment_methods ADD COLUMN linked_account_id UUID REFERENCES financial_accounts(id) ON DELETE SET NULL;

-- ============================================================
-- RECURRING PLEDGES — o compromisso de recorrência em si (distinto
-- de `pledges`, que é o registro de cada evento/mês). Exige conta
-- (reporter_user_id NOT NULL): diferente do pledge avulso, aqui
-- precisa ser a mesma pessoa identificável mês a mês.
-- ============================================================
CREATE TABLE public.recurring_pledges (
  id                      UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  profile_id              UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  partner_id              UUID REFERENCES partners(id) ON DELETE CASCADE NOT NULL,
  reporter_user_id        UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  amount                  NUMERIC(15, 2) NOT NULL,
  currency                TEXT NOT NULL,
  payment_method          TEXT NOT NULL CHECK (payment_method IN (
                            'pix', 'mercadopago', 'paypal', 'wise', 'bank_transfer', 'revolut',
                            'zelle', 'venmo', 'cashapp', 'alipay', 'wechatpay', 'mpesa', 'crypto', 'other', 'stripe'
                          )),
  highlight_id            UUID REFERENCES highlights(id) ON DELETE SET NULL,
  reminder_opt_in         BOOLEAN NOT NULL DEFAULT true,
  next_reminder_at        DATE,
  stripe_subscription_id  TEXT,
  status                  TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('pending', 'active', 'paused', 'cancelled')),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_recurring_pledges_profile_id ON recurring_pledges (profile_id);
CREATE INDEX idx_recurring_pledges_reminder ON recurring_pledges (next_reminder_at) WHERE status = 'active' AND next_reminder_at IS NOT NULL;
CREATE INDEX idx_recurring_pledges_subscription ON recurring_pledges (stripe_subscription_id) WHERE stripe_subscription_id IS NOT NULL;

ALTER TABLE recurring_pledges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "recurring_pledges_owner_all" ON recurring_pledges
  FOR ALL USING (is_profile_owner(profile_id));

-- Autenticado é suficiente pra criar (não WITH CHECK (true) como em pledges_insert_public)
-- porque recorrência exige conta — quem cria já é o dono da linha.
CREATE POLICY "recurring_pledges_insert_self" ON recurring_pledges
  FOR INSERT WITH CHECK (auth.uid() = reporter_user_id);

CREATE POLICY "recurring_pledges_self_read" ON recurring_pledges
  FOR SELECT USING (auth.uid() = reporter_user_id);

-- pledges: cada cobrança mensal confirmada por um compromisso recorrente
-- se liga de volta a ele, e 'stripe' passa a ser um payment_method válido.
ALTER TABLE pledges ADD COLUMN recurring_pledge_id UUID REFERENCES recurring_pledges(id) ON DELETE SET NULL;
ALTER TABLE pledges DROP CONSTRAINT pledges_payment_method_check;
ALTER TABLE pledges ADD CONSTRAINT pledges_payment_method_check CHECK (payment_method IN (
  'pix', 'mercadopago', 'paypal', 'wise', 'bank_transfer', 'revolut',
  'zelle', 'venmo', 'cashapp', 'alipay', 'wechatpay', 'mpesa', 'crypto', 'other', 'stripe'
));
