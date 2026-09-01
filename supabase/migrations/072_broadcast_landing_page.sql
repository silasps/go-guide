-- ============================================================
-- Landing page pública de uma atualização (pra copiar o link e mandar
-- por WhatsApp — não existe integração real de API do WhatsApp ainda,
-- então "enviar por WhatsApp" por enquanto é o missionário colando um
-- link). A tabela em si continua fechada pro dono (RLS normal); a leitura
-- pública passa só pela function SECURITY DEFINER abaixo, que devolve
-- exclusivamente os campos necessários pra montar a página — nunca
-- recipient_count/recipient_filter/sender_user_id — pra ninguém com a
-- anon key conseguir listar/varrer broadcasts de terceiros via REST.
-- Mesmo padrão já usado por resolve_short_link() (migration 070).
-- ============================================================
ALTER TABLE public.partner_broadcasts ADD COLUMN IF NOT EXISTS financial_snapshot JSONB;

CREATE OR REPLACE FUNCTION get_public_broadcast(p_id UUID)
RETURNS TABLE(profile_id UUID, subject TEXT, body TEXT, highlight_ids UUID[], financial_snapshot JSONB, created_at TIMESTAMPTZ)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT profile_id, subject, body, highlight_ids, financial_snapshot, created_at
  FROM partner_broadcasts
  WHERE id = p_id;
$$;
