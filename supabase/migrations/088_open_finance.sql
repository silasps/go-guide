-- ============================================================
-- Open Finance (Pluggy) — conexão bancária automatizada, ver botão
-- "Gerenciar Open Finance" em /dashboard/financeiro/contas
-- (system.architecture.md 7.29). Estava deliberadamente fora de escopo até
-- aqui (várias rodadas — 7.20/7.21/7.24/7.29); implementado a pedido do
-- usuário. Provedor: Pluggy (agregador certificado — Open Finance no Brasil
-- exige um agregador homologado, não dá pra integrar direto com os bancos).
--
-- `open_finance_items`: uma conexão (login) num banco via widget Pluggy
-- Connect — 1 item pode expor N contas.
-- `open_finance_accounts`: mapeia cada conta Pluggy pra uma linha de
-- `financial_accounts` (criada automaticamente na primeira sincronização).
-- `transactions.pluggy_transaction_id` dedup a importação de lançamentos
-- entre sincronizações (cron diário + webhook + "sincronizar agora").
-- ============================================================

CREATE TABLE public.open_finance_items (
  id                    UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  profile_id            UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  created_by_user_id    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  pluggy_item_id        TEXT UNIQUE NOT NULL,
  connector_id          INTEGER,
  connector_name        TEXT NOT NULL,
  connector_image_url   TEXT,
  -- Espelha o `ItemStatus` da Pluggy: UPDATED (ok) / UPDATING (sincronizando) /
  -- WAITING_USER_INPUT (MFA pendente) / LOGIN_ERROR (precisa reconectar) /
  -- OUTDATED (erro pontual, pode tentar de novo sozinho no próximo cron).
  status                TEXT NOT NULL DEFAULT 'UPDATING' CHECK (status IN ('UPDATED', 'UPDATING', 'WAITING_USER_INPUT', 'LOGIN_ERROR', 'OUTDATED')),
  last_synced_at        TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_open_finance_items_profile_id ON open_finance_items (profile_id);

CREATE TRIGGER open_finance_items_updated_at BEFORE UPDATE ON open_finance_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE public.open_finance_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "open_finance_items_owner_all" ON open_finance_items
  FOR ALL USING (is_profile_owner(profile_id));

CREATE TABLE public.open_finance_accounts (
  id                    UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  item_id               UUID REFERENCES open_finance_items(id) ON DELETE CASCADE NOT NULL,
  financial_account_id  UUID REFERENCES financial_accounts(id) ON DELETE CASCADE NOT NULL,
  pluggy_account_id     TEXT UNIQUE NOT NULL,
  pluggy_type           TEXT NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_open_finance_accounts_item_id ON open_finance_accounts (item_id);
CREATE INDEX idx_open_finance_accounts_financial_account_id ON open_finance_accounts (financial_account_id);

ALTER TABLE public.open_finance_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "open_finance_accounts_owner_all" ON open_finance_accounts
  FOR ALL USING (EXISTS (
    SELECT 1 FROM open_finance_items i WHERE i.id = open_finance_accounts.item_id AND is_profile_owner(i.profile_id)
  ));

-- Flag denormalizada (evita join em toda renderização de `AccountCard`) —
-- true enquanto a conta estiver vinculada a um `open_finance_accounts`;
-- desconectar o item (DELETE /api/open-finance/items/[id]) volta pra false
-- mas MANTÉM a conta e o histórico de lançamentos já importados.
ALTER TABLE public.financial_accounts
  ADD COLUMN IF NOT EXISTS is_open_finance BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS pluggy_transaction_id TEXT UNIQUE;

ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_source_check;
ALTER TABLE public.transactions ADD CONSTRAINT transactions_source_check
  CHECK (source IN ('manual', 'whatsapp', 'api', 'recurring', 'open_finance'));
