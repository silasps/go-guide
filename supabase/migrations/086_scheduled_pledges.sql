-- ============================================================
-- Oferta agendada: alguém que quer ajudar mas só numa data futura
-- específica ("só posso te ajudar dia 10") registra a intenção — sem
-- pedir método de pagamento nem cobrar nada agora — e é lembrado (in-app +
-- e-mail) quando a data chega, caindo direto no fluxo normal de doação
-- avulsa (PledgeForm) pra completar de verdade. Diferente de
-- recurring_pledges (compromisso mensal recorrente): isso é pontual, uma
-- única data, exige conta (pra poder ser lembrada) mas não exige valor
-- (é só uma estimativa opcional).
-- ============================================================
CREATE TABLE public.scheduled_pledges (
  id                UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  profile_id        UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  partner_id        UUID REFERENCES public.partners(id) ON DELETE CASCADE NOT NULL,
  reporter_user_id  UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  amount            NUMERIC(15, 2),
  currency          TEXT,
  highlight_id      UUID REFERENCES public.highlights(id) ON DELETE SET NULL,
  scheduled_date    DATE NOT NULL,
  status            TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'fulfilled', 'cancelled')),
  reminded_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_scheduled_pledges_due ON public.scheduled_pledges (scheduled_date) WHERE status = 'pending';
CREATE INDEX idx_scheduled_pledges_profile_id ON public.scheduled_pledges (profile_id);

ALTER TABLE public.scheduled_pledges ENABLE ROW LEVEL SECURITY;

-- Mesmo padrão de recurring_pledges: o missionário dono do perfil enxerga
-- tudo (mesmo sem tela nenhuma consumindo isso ainda — custa zero hoje e
-- evita migration nova se um painel for construído depois), e quem
-- agendou só mexe no próprio registro.
CREATE POLICY "scheduled_pledges_owner_all" ON public.scheduled_pledges
  FOR ALL USING (is_profile_owner(profile_id));

CREATE POLICY "scheduled_pledges_self_all" ON public.scheduled_pledges
  FOR ALL USING (auth.uid() = reporter_user_id);

CREATE POLICY "scheduled_pledges_insert_self" ON public.scheduled_pledges
  FOR INSERT WITH CHECK (auth.uid() = reporter_user_id);

-- Rastreabilidade da oferta real até a intenção que a originou — mesma
-- ideia de pledges.recurring_pledge_id (migration 031).
ALTER TABLE public.pledges ADD COLUMN scheduled_pledge_id UUID REFERENCES public.scheduled_pledges(id) ON DELETE SET NULL;
