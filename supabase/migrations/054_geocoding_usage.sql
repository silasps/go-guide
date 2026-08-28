-- ============================================================
-- Contador de uso mensal por provider de geocoding externo
-- (Google Places, Mapbox), pra sustentar a cascata de fallback
-- Google -> Mapbox -> Photon do getNearbyLocations/searchLocations
-- (src/lib/geocoding/). Não é dado de usuário: é um contador global
-- do sistema, chave (provider, period) onde period = 'YYYY-MM' (UTC).
-- Zerar todo mês não precisa de cron: um mês novo é simplesmente uma
-- linha nova (upsert por chave primária), então o contador "reseta"
-- sozinho no dia 1 sem nenhum job agendado.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.geocoding_usage (
  provider   TEXT NOT NULL CHECK (provider IN ('google_places', 'mapbox')),
  period     TEXT NOT NULL, -- 'YYYY-MM', UTC
  count      INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (provider, period)
);

ALTER TABLE public.geocoding_usage ENABLE ROW LEVEL SECURITY;
-- Nenhuma policy criada de propósito: esta tabela só é tocada pelo client
-- service-role (bypassa RLS por definição) dentro de src/lib/geocoding/
-- usage.ts; não há leitura/escrita vinda de client anon/authenticated.
-- RLS habilitada + zero policies já é "nega tudo" pros papéis normais.

-- Incremento atômico: INSERT ... ON CONFLICT DO UPDATE já é atômico como
-- statement único no Postgres, sem precisar de FOR UPDATE/SECURITY DEFINER
-- (diferente de consume_ai_credits, migration 025, que debita saldo de
-- usuário via client anônimo — aqui quem chama é sempre o service-role
-- client do servidor).
CREATE OR REPLACE FUNCTION public.increment_geocoding_usage(p_provider TEXT, p_period TEXT)
RETURNS INTEGER
LANGUAGE sql
AS $$
  INSERT INTO public.geocoding_usage (provider, period, count, updated_at)
  VALUES (p_provider, p_period, 1, now())
  ON CONFLICT (provider, period)
  DO UPDATE SET count = geocoding_usage.count + 1, updated_at = now()
  RETURNING count;
$$;
