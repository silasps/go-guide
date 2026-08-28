-- ============================================================
-- Campo opcional de telefone/WhatsApp de quem reporta uma oferta —
-- pedido do usuário: dá pro missionário um jeito de retribuir contato
-- direto, além do e-mail (que muita gente nem preenche).
-- ============================================================
ALTER TABLE pledges
  ADD COLUMN IF NOT EXISTS reporter_phone TEXT;
