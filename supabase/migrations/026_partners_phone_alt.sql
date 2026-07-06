-- ============================================================
-- Campo de telefone secundário (opcional) para partners.
-- `phone` continua sendo o WhatsApp (usado por toda a UI);
-- `phone_alt` é um telefone alternativo, sem uso automatizado.
-- ============================================================
ALTER TABLE public.partners
  ADD COLUMN IF NOT EXISTS phone_alt TEXT;
