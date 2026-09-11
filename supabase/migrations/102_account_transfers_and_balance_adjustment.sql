-- ============================================================
-- Transferência entre contas + Ajuste de saldo (tela de Contas bancárias
-- estilo GranaZen, ver system.architecture.md 7.29/Changelog) — `type =
-- 'transfer'` já existia em `transactions` (e até no seletor do
-- `TransactionForm`, opção "🔁 Transf."), mas era decorativo: não havia
-- coluna de conta de destino e o trigger de saldo não tinha branch pra
-- esse tipo, então criar uma transação assim nunca mexeu no saldo de
-- ninguém. Esta migration conserta isso.
--
-- Modelo escolhido: cada transferência vira DUAS linhas em `transactions`
-- (uma por conta afetada, mesmo padrão de qualquer outro lançamento),
-- marcadas com o mesmo `transfer_group_id` pra serem editadas/excluídas
-- juntas. `transfer_direction` diz se aquela perna é a saída ('out', a
-- conta perde o valor) ou a entrada ('in', a conta ganha) — `amount`
-- continua sempre positivo, sem inverter sinal, pra não quebrar nenhum
-- código existente que assume isso (ex: máscara de valor do
-- TransactionForm). `transfer_account_id` guarda a OUTRA conta da dupla,
-- só pra exibição ("Transferência para/de X").
-- ============================================================
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS transfer_group_id UUID,
  ADD COLUMN IF NOT EXISTS transfer_direction TEXT CHECK (transfer_direction IN ('out', 'in')),
  ADD COLUMN IF NOT EXISTS transfer_account_id UUID REFERENCES financial_accounts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_transfer_group_id ON transactions (transfer_group_id) WHERE transfer_group_id IS NOT NULL;

-- "Ajustar saldo" não precisa de coluna nova — é só um lançamento
-- income/expense normal (delta entre saldo atual e saldo alvo) com uma
-- `source` própria pra identificar a origem, mesmo padrão de
-- 'opening_balance' (migration 095).
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_source_check;
ALTER TABLE public.transactions ADD CONSTRAINT transactions_source_check
  CHECK (source IN ('manual', 'whatsapp', 'api', 'recurring', 'open_finance', 'import', 'opening_balance', 'balance_adjustment'));

-- Trigger de saldo (migration 081) ganha o branch de transfer — resto da
-- função fica idêntico (income/expense, is_paid, UPDATE/DELETE via
-- delta). Cada linha só mexe no saldo da própria `account_id`; a "outra"
-- ponta é resolvida pela linha irmã, inserida no mesmo INSERT em lote.
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
      ELSIF OLD.type = 'transfer' THEN old_delta := CASE WHEN OLD.transfer_direction = 'out' THEN -OLD.amount ELSE OLD.amount END;
      END IF;
    END IF;
    UPDATE financial_accounts SET balance = balance - old_delta WHERE id = OLD.account_id;
  END IF;

  IF TG_OP IN ('UPDATE', 'INSERT') THEN
    IF NEW.is_paid THEN
      IF NEW.type = 'income' THEN new_delta := NEW.amount;
      ELSIF NEW.type = 'expense' THEN new_delta := -NEW.amount;
      ELSIF NEW.type = 'transfer' THEN new_delta := CASE WHEN NEW.transfer_direction = 'out' THEN -NEW.amount ELSE NEW.amount END;
      END IF;
    END IF;
    UPDATE financial_accounts SET balance = balance + new_delta WHERE id = NEW.account_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;
