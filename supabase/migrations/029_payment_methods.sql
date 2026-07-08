-- ============================================================
-- PAYMENT METHODS — substitui as 4 colunas fixas em profiles
-- (pix_key, paypal_url, wise_url, external_donation_url) por uma
-- lista de métodos de recebimento, cobrindo formas usadas fora do
-- Brasil/EUA (Zelle, Alipay, M-Pesa, transferência internacional,
-- cripto, etc), com múltiplos métodos por perfil.
-- ============================================================
CREATE TABLE public.payment_methods (
  id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  profile_id  UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  type        TEXT NOT NULL CHECK (type IN (
                'pix', 'mercadopago', 'paypal', 'wise', 'bank_transfer', 'revolut',
                'zelle', 'venmo', 'cashapp', 'alipay', 'wechatpay', 'mpesa', 'crypto', 'other')),
  label       TEXT,
  value       TEXT NOT NULL,
  details     TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  sort_order  INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payment_methods_profile_id ON payment_methods (profile_id);

ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;

-- Dono do perfil (ou gestor com role 'manager', via is_profile_owner) gerencia.
CREATE POLICY "payment_methods_owner_all" ON payment_methods
  FOR ALL USING (is_profile_owner(profile_id));

-- Leitura pública dos métodos ativos, mesma regra de profiles_public_read.
CREATE POLICY "payment_methods_public_read" ON payment_methods
  FOR SELECT USING (
    is_active AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = payment_methods.profile_id
        AND (profiles.privacy_mode = 'public'
             OR profiles.user_id = auth.uid()
             OR EXISTS (SELECT 1 FROM partners WHERE partners.profile_id = profiles.id AND partners.user_id = auth.uid()))
    )
  );

-- ============================================================
-- Backfill dos dados existentes e remoção das colunas antigas
-- ============================================================
INSERT INTO payment_methods (profile_id, type, value, sort_order)
SELECT id, 'pix', pix_key, 0 FROM profiles WHERE pix_key IS NOT NULL AND pix_key <> '';

INSERT INTO payment_methods (profile_id, type, value, sort_order)
SELECT id, 'paypal', paypal_url, 1 FROM profiles WHERE paypal_url IS NOT NULL AND paypal_url <> '';

INSERT INTO payment_methods (profile_id, type, value, sort_order)
SELECT id, 'wise', wise_url, 2 FROM profiles WHERE wise_url IS NOT NULL AND wise_url <> '';

INSERT INTO payment_methods (profile_id, type, label, value, sort_order)
SELECT id, 'other', 'Doação', external_donation_url, 3 FROM profiles WHERE external_donation_url IS NOT NULL AND external_donation_url <> '';

ALTER TABLE profiles
  DROP COLUMN pix_key,
  DROP COLUMN paypal_url,
  DROP COLUMN wise_url,
  DROP COLUMN external_donation_url;

-- ============================================================
-- pledges.payment_method precisa aceitar qualquer tipo do catálogo,
-- não só os 4 originais.
-- ============================================================
ALTER TABLE pledges DROP CONSTRAINT pledges_payment_method_check;
ALTER TABLE pledges ADD CONSTRAINT pledges_payment_method_check CHECK (payment_method IN (
  'pix', 'mercadopago', 'paypal', 'wise', 'bank_transfer', 'revolut',
  'zelle', 'venmo', 'cashapp', 'alipay', 'wechatpay', 'mpesa', 'crypto', 'other'
));
