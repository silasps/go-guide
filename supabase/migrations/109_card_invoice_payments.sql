-- ============================================================
-- Pagamento de fatura de cartão (ver system.architecture.md 7.47).
--
-- 1) `paid_from_account_id`: conta corrente que debita a fatura deste cartão.
-- 2) `card_invoice_account_id` / `card_invoice_fatura_date`: marcam a perna
--    de saída (conta corrente) do pagamento de uma fatura. O índice único
--    garante no máximo um pagamento por cartão e fatura.
-- ============================================================

ALTER TABLE public.financial_accounts
  ADD COLUMN IF NOT EXISTS paid_from_account_id UUID REFERENCES public.financial_accounts(id) ON DELETE SET NULL;

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS card_invoice_account_id UUID REFERENCES public.financial_accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS card_invoice_fatura_date DATE;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_card_invoice_payment
  ON public.transactions (card_invoice_account_id, card_invoice_fatura_date)
  WHERE card_invoice_account_id IS NOT NULL;
