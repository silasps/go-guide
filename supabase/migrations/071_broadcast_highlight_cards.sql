-- ============================================================
-- Cartões de projeto (imagem + progresso + link real) no e-mail de
-- atualização — gerados por CÓDIGO no envio, não pela IA (mais confiável:
-- nunca inventa URL nem imagem errada). Guarda só os IDs escolhidos no
-- momento da composição; o cron busca os dados atualizados (capa,
-- progresso) na hora de montar o e-mail de verdade.
-- ============================================================
ALTER TABLE public.partner_broadcasts ADD COLUMN IF NOT EXISTS highlight_ids UUID[] NOT NULL DEFAULT '{}';
