-- ============================================================
-- Vincular transações a um projeto/highlight (fundação para
-- breakdown por categoria e conciliação de ofertas)
-- ============================================================
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS highlight_id UUID REFERENCES highlights(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_highlight_id ON transactions (highlight_id) WHERE highlight_id IS NOT NULL;

-- Quando uma transação de income/expense está vinculada a um projeto,
-- refletir no total arrecadado do projeto (mesmo padrão do saldo de conta).
CREATE OR REPLACE FUNCTION update_highlight_current_amount()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.highlight_id IS NOT NULL AND NEW.type = 'income' THEN
      UPDATE highlights SET current_amount = current_amount + NEW.amount WHERE id = NEW.highlight_id;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.highlight_id IS NOT NULL AND OLD.type = 'income' THEN
      UPDATE highlights SET current_amount = current_amount - OLD.amount WHERE id = OLD.highlight_id;
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_highlight_amount
  AFTER INSERT OR DELETE ON transactions
  FOR EACH ROW EXECUTE FUNCTION update_highlight_current_amount();
