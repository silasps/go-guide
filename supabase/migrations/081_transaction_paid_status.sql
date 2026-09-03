-- ============================================================
-- Status pago/recebido em `transactions` — habilita "Saldo previsto" no
-- dashboard financeiro (modelo GranaZen, ver system.architecture.md 7.19):
-- até aqui toda transação inserida contava pro saldo da conta na hora,
-- mesmo se tivesse `date` no futuro (ex: aluguel lançado com vencimento
-- dia 15 do mês que vem já derrubava o saldo hoje) — não existia conceito
-- de "ainda não paguei"/"ainda não recebi". `is_paid` cobre isso.
-- Default `true` é deliberado: preserva 100% do comportamento atual pra
-- toda linha existente e todo INSERT novo que não mexer no checkbox (inclui
-- o cron `generate-recurring-transactions`, que continua sem confirmação
-- humana — decisão já tomada na migration 077, não muda aqui).
-- ============================================================
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS is_paid BOOLEAN NOT NULL DEFAULT true;

-- Trigger de saldo agregado passa a: (1) também disparar em UPDATE — antes
-- só INSERT/DELETE, então editar valor/tipo/conta de uma transação existente
-- não resincronizava `financial_accounts.balance` (risco operacional já
-- registrado na seção 3.1); (2) só contar transação pro saldo quando
-- `is_paid = true` — é isso que faz marcar "Já paguei"/"Já recebi" (ou
-- desmarcar) mover dinheiro de verdade. Delta-based: reverte o efeito da
-- linha OLD e aplica o efeito da linha NEW num único UPDATE, então também
-- cobre corretamente conta/tipo/valor mudando ao mesmo tempo.
CREATE OR REPLACE FUNCTION update_account_balance()
RETURNS TRIGGER AS $$
DECLARE
  old_delta NUMERIC(15,2) := 0;
  new_delta NUMERIC(15,2) := 0;
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    IF OLD.is_paid THEN
      IF OLD.type = 'income' THEN old_delta := OLD.amount;
      ELSIF OLD.type = 'expense' THEN old_delta := -OLD.amount;
      END IF;
    END IF;
    UPDATE financial_accounts SET balance = balance - old_delta WHERE id = OLD.account_id;
  END IF;

  IF TG_OP IN ('UPDATE', 'INSERT') THEN
    IF NEW.is_paid THEN
      IF NEW.type = 'income' THEN new_delta := NEW.amount;
      ELSIF NEW.type = 'expense' THEN new_delta := -NEW.amount;
      END IF;
    END IF;
    UPDATE financial_accounts SET balance = balance + new_delta WHERE id = NEW.account_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_balance ON transactions;
CREATE TRIGGER trg_update_balance
  AFTER INSERT OR UPDATE OR DELETE ON transactions
  FOR EACH ROW EXECUTE FUNCTION update_account_balance();

-- Deliberadamente FORA de escopo: `update_highlight_current_amount()`
-- (arrecadado do projeto) e a view `project_budget_progress` (raised/spent
-- por categoria de orçamento) continuam contando toda transação, pago ou
-- não — são conceitos de fundraising público (quanto já foi prometido/
-- movimentado pro projeto), não o fluxo de caixa pessoal do missionário que
-- o Saldo Previsto resolve. Misturar os dois faria uma oferta pendente
-- sumir da barra de progresso pública até ser marcada como paga, o que
-- muda comportamento de uma feature diferente sem necessidade.
