-- ============================================================
-- Modo de privacidade da prestação de contas dentro de uma atualização
-- pra parceiros (ver migration 072/073 e system.architecture.md 7.10-bis).
-- Até aqui, `financial_snapshot` sempre saía com valores exatos pra
-- QUALQUER pessoa com o link da landing page (`get_public_broadcast`
-- não checava nada). Isso finalmente dá ao missionário uma escolha, por
-- atualização: `exact` (comportamento de sempre, default — não muda nada
-- pra quem já usa a feature) ou `percent_only`, que reserva os valores
-- exatos só a quem tem o grant `financial_summary` (`partner_visibility_grants`,
-- migration 011) — grant que existia desde sempre no toggle
-- (`VisibilityGrantsDialog`) mas nunca era lido em lugar nenhum do código.
-- A redação de fato acontece em TypeScript, no Server Component da landing
-- page (sem `'use client'` na árvore que recebe o snapshot bruto, então o
-- JSON exato nunca é serializado pro cliente) — aqui só muda o schema pra
-- guardar a escolha e devolvê-la pra página decidir o que renderizar.
-- ============================================================
ALTER TABLE public.partner_broadcasts
  ADD COLUMN IF NOT EXISTS financial_visibility TEXT NOT NULL DEFAULT 'exact'
  CHECK (financial_visibility IN ('exact', 'percent_only'));

-- Muda as colunas de retorno da function -> precisa DROP antes do CREATE.
DROP FUNCTION IF EXISTS get_public_broadcast(uuid);

CREATE FUNCTION get_public_broadcast(p_id UUID)
RETURNS TABLE(profile_id UUID, subject TEXT, body TEXT, highlight_ids UUID[], financial_snapshot JSONB, financial_visibility TEXT, created_at TIMESTAMPTZ)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT profile_id, subject, body, highlight_ids, financial_snapshot, financial_visibility, created_at
  FROM partner_broadcasts
  WHERE id = p_id;
$$;
