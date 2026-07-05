-- ============================================================
-- Corrige recursão infinita de RLS entre financial_accounts e
-- account_members — mesmo padrão do bug profiles<->partners
-- corrigido na migration 004, só que nunca tinha sido exercitado
-- porque não havia UI para financial_accounts antes desta sessão.
--
-- financial_accounts_owner_all consultava account_members, e
-- account_members_owner_all consultava financial_accounts de volta:
-- "infinite recursion detected in policy for relation financial_accounts".
-- ============================================================
CREATE OR REPLACE FUNCTION is_account_member(p_account_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM account_members
    WHERE account_id = p_account_id AND user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION owns_account_profile(p_account_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM financial_accounts fa
    JOIN profiles p ON p.id = fa.profile_id
    WHERE fa.id = p_account_id AND p.user_id = auth.uid()
  );
$$;

DROP POLICY IF EXISTS "financial_accounts_owner_all" ON financial_accounts;
CREATE POLICY "financial_accounts_owner_all" ON financial_accounts
  FOR ALL USING (
    is_profile_owner(profile_id) OR is_account_member(id)
  );

DROP POLICY IF EXISTS "account_members_owner_all" ON account_members;
CREATE POLICY "account_members_owner_all" ON account_members
  FOR ALL USING (
    owns_account_profile(account_id) OR auth.uid() = user_id
  );

-- transactions_owner_all consultava account_members diretamente — troca
-- pela função para não reativar o mesmo ciclo ao ler lançamentos de
-- uma conta compartilhada.
DROP POLICY IF EXISTS "transactions_owner_all" ON transactions;
CREATE POLICY "transactions_owner_all" ON transactions
  FOR ALL USING (
    is_profile_owner(profile_id) OR is_account_member(account_id)
  );
