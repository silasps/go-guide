-- ============================================================
-- Comprovante opcional por lançamento (não só por pledge de parceiro) —
-- pedido do usuário: "coloque um botão para fazer upload do comprovante
-- como opcional. Caso a pessoa queira colocar isso e ter histórico".
-- Mesmo padrão de `pledges.proof_url` (migration 012): URL pública do
-- bucket `media`, sem FK (é storage, não uma tabela).
-- ============================================================

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS proof_url TEXT;
