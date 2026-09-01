-- ============================================================
-- Camada temporária de encurtamento externo (ver migration 070) — sem
-- domínio curto próprio ainda, então o link /l/[code] é embrulhado por
-- um encurtador público gratuito (is.gd) na hora da geração, guardando
-- o resultado pra não rechamar a API a cada "copiar link". Pedido do
-- usuário como medida provisória até a compra de um domínio curto —
-- quando isso acontecer, essa coluna simplesmente para de ser usada
-- (código já cai de volta pro link próprio se ela ficar vazia).
-- ============================================================
ALTER TABLE public.short_links ADD COLUMN IF NOT EXISTS external_short_url TEXT;
