-- ============================================================
-- Tradução de conteúdo (posts.content, profiles.bio) via IA.
-- Padrão: coluna original inalterada + idioma original explícito
-- + JSONB só com as traduções das OUTRAS línguas (nunca duplica
-- o original). Mesma forma nos dois casos para reaproveitar
-- lógica de resolução no front. RLS não muda: políticas de
-- posts/profiles já são row-level (posts_public_read,
-- profiles_public_read — ver 023_profile_managers.sql).
-- ============================================================

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS original_locale TEXT NOT NULL DEFAULT 'pt' CHECK (original_locale IN ('pt','en','es')),
  ADD COLUMN IF NOT EXISTS translations JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS bio_locale TEXT NOT NULL DEFAULT 'pt' CHECK (bio_locale IN ('pt','en','es')),
  ADD COLUMN IF NOT EXISTS bio_translations JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Backfill: melhor estimativa disponível para bio_locale das
-- contas já existentes é o idioma de UI que o usuário já tinha
-- escolhido (profiles.locale, migration 024). Depois deste
-- backfill os dois campos ficam desacoplados: mudar o idioma da
-- UI não altera mais retroativamente o idioma "original" da bio.
UPDATE public.profiles SET bio_locale = locale WHERE bio_locale = 'pt';

-- ============================================================
-- Débito atômico de créditos de IA (schema já existia desde a
-- 001_initial_schema.sql: profiles.ai_credits + ai_credit_transactions;
-- só faltava a função que os usa). SECURITY DEFINER + FOR UPDATE
-- evita corrida entre dono e gestor clicando "Traduzir" ao mesmo
-- tempo (mesmo padrão anti-recursão/atomicidade de
-- invite_profile_manager, migration 023).
-- ============================================================
CREATE OR REPLACE FUNCTION consume_ai_credits(p_profile_id uuid, p_amount integer, p_reason text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_balance integer;
BEGIN
  IF NOT is_profile_owner(p_profile_id) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'invalid_amount';
  END IF;

  SELECT ai_credits INTO v_balance FROM profiles WHERE id = p_profile_id FOR UPDATE;

  IF v_balance IS NULL OR v_balance < p_amount THEN
    RAISE EXCEPTION 'insufficient_ai_credits';
  END IF;

  UPDATE profiles SET ai_credits = ai_credits - p_amount WHERE id = p_profile_id;
  INSERT INTO ai_credit_transactions (profile_id, amount, reason) VALUES (p_profile_id, -p_amount, p_reason);

  RETURN v_balance - p_amount;
END;
$$;
