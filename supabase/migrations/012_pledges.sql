-- ============================================================
-- Data de início da missão (usada na chamada "faça parte do que
-- o Senhor está fazendo através da minha vida desde {ano}")
-- ============================================================
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS mission_start_date DATE;

-- Evita duplicar o mesmo usuário como parceiro do mesmo perfil
CREATE UNIQUE INDEX IF NOT EXISTS idx_partners_profile_user_unique ON partners (profile_id, user_id) WHERE user_id IS NOT NULL;

-- ============================================================
-- PLEDGES — registro manual de oferta (Pix/transferência/PayPal/Wise)
-- reportada pelo parceiro, a ser confirmada pelo missionário
-- ============================================================
CREATE TABLE public.pledges (
  id                       UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  highlight_id             UUID REFERENCES highlights(id) ON DELETE SET NULL,
  profile_id               UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  partner_id               UUID REFERENCES partners(id) ON DELETE SET NULL,
  reporter_user_id         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reporter_name            TEXT NOT NULL,
  reporter_email           TEXT,
  reported_amount          NUMERIC(15, 2) NOT NULL,
  currency                 TEXT NOT NULL DEFAULT 'BRL',
  payment_method           TEXT NOT NULL CHECK (payment_method IN ('pix', 'paypal', 'wise', 'bank_transfer', 'other')),
  reported_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  proof_url                TEXT,
  is_recurring_pledge      BOOLEAN NOT NULL DEFAULT false,
  status                   TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'rejected')),
  confirmed_transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
  reviewed_by_user_id      UUID REFERENCES auth.users(id),
  reviewed_at              TIMESTAMPTZ,
  rejection_reason         TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pledges_profile_id ON pledges (profile_id, status);
CREATE INDEX idx_pledges_highlight_id ON pledges (highlight_id) WHERE highlight_id IS NOT NULL;

ALTER TABLE public.pledges ENABLE ROW LEVEL SECURITY;

-- Qualquer pessoa (autenticada ou anônima) pode registrar uma oferta.
CREATE POLICY "pledges_insert_public" ON pledges
  FOR INSERT WITH CHECK (true);

-- Dono do perfil gerencia (revisar, confirmar, rejeitar) as ofertas recebidas.
CREATE POLICY "pledges_owner_all" ON pledges
  FOR ALL USING (is_profile_owner(profile_id));

-- Quem reportou pode ver o status do próprio registro.
CREATE POLICY "pledges_reporter_read" ON pledges
  FOR SELECT USING (auth.uid() = reporter_user_id);
