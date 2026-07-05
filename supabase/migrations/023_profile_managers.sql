-- ============================================================
-- Contas vinculadas (estilo Instagram): um perfil pode ter usuários
-- adicionais com acesso de "manager" (mesmo nível do dono, exceto
-- trocar e-mail/excluir conta) ou "viewer" (somente leitura — ex.:
-- alguém da diretoria que só quer ver relatórios). Nenhuma tabela de
-- negócio (posts, highlights, financeiro, oração, parceiros) muda de
-- forma — só quem pode agir "como" aquele profile_id é ampliado.
-- ============================================================
CREATE TABLE public.profile_managers (
  id                 UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  profile_id         UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  user_id            UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role               TEXT NOT NULL DEFAULT 'manager' CHECK (role IN ('manager', 'viewer')),
  invited_by_user_id UUID REFERENCES auth.users(id),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (profile_id, user_id)
);

CREATE INDEX idx_profile_managers_profile_id ON profile_managers (profile_id);
CREATE INDEX idx_profile_managers_user_id ON profile_managers (user_id);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS extra_manager_seats INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.profile_managers ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- is_profile_owner() (migration 004) passa a também reconhecer
-- gestores. Isso estende automaticamente o acesso de escrita a toda
-- tabela que já chama esse helper (partners, pledges, project_members,
-- dados E2EE, financial_accounts, transactions, budget categories)
-- sem precisar reescrever a política dessas tabelas.
-- ============================================================
CREATE OR REPLACE FUNCTION is_profile_owner(p_profile_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = p_profile_id AND user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM profile_managers
    WHERE profile_id = p_profile_id AND user_id = auth.uid() AND role = 'manager'
  );
$$;

CREATE OR REPLACE FUNCTION is_profile_viewer_or_above(p_profile_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT is_profile_owner(p_profile_id)
  OR EXISTS (
    SELECT 1 FROM profile_managers
    WHERE profile_id = p_profile_id AND user_id = auth.uid() AND role = 'viewer'
  );
$$;

CREATE POLICY "profile_managers_owner_manage" ON profile_managers
  FOR ALL USING (is_profile_owner(profile_id));

CREATE POLICY "profile_managers_self_read" ON profile_managers
  FOR SELECT USING (auth.uid() = user_id);

-- owns_account_profile() (migration 019) também precisa reconhecer
-- gestores, senão um gestor não enxerga o financeiro da conta vinculada.
CREATE OR REPLACE FUNCTION owns_account_profile(p_account_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM financial_accounts fa
    WHERE fa.id = p_account_id AND is_profile_owner(fa.profile_id)
  );
$$;

-- ============================================================
-- Políticas de 002_rls_policies.sql que faziam o check de dono direto
-- inline (escritas antes de is_profile_owner() existir, migration 004)
-- — migradas para o helper, para também reconhecer gestores/viewers.
-- ============================================================
DROP POLICY IF EXISTS "profiles_owner_all" ON profiles;
CREATE POLICY "profiles_owner_all" ON profiles
  FOR ALL USING (auth.uid() = user_id OR is_profile_owner(id));

DROP POLICY IF EXISTS "profiles_public_read" ON profiles;
CREATE POLICY "profiles_public_read" ON profiles
  FOR SELECT USING (
    privacy_mode = 'public'
    OR auth.uid() = user_id
    OR is_profile_viewer_or_above(id)
  );

DROP POLICY IF EXISTS "posts_owner_all" ON posts;
CREATE POLICY "posts_owner_all" ON posts
  FOR ALL USING (is_profile_owner(profile_id));

DROP POLICY IF EXISTS "posts_public_read" ON posts;
CREATE POLICY "posts_public_read" ON posts
  FOR SELECT USING (
    (published_at IS NOT NULL AND is_draft = false AND (
      EXISTS (SELECT 1 FROM profiles WHERE profiles.id = posts.profile_id AND profiles.privacy_mode = 'public')
      OR auth.uid() = created_by_user_id
      OR EXISTS (SELECT 1 FROM partners WHERE partners.profile_id = posts.profile_id AND partners.user_id = auth.uid())
    ))
    OR is_profile_viewer_or_above(profile_id)
  );

DROP POLICY IF EXISTS "highlights_owner_all" ON highlights;
CREATE POLICY "highlights_owner_all" ON highlights
  FOR ALL USING (is_profile_owner(profile_id));

DROP POLICY IF EXISTS "highlights_public_read" ON highlights;
CREATE POLICY "highlights_public_read" ON highlights
  FOR SELECT USING (
    (status = 'active' AND (
      EXISTS (SELECT 1 FROM profiles WHERE profiles.id = highlights.profile_id AND profiles.privacy_mode = 'public')
      OR EXISTS (SELECT 1 FROM partners WHERE partners.profile_id = highlights.profile_id AND partners.user_id = auth.uid())
    ))
    OR is_profile_viewer_or_above(profile_id)
  );

DROP POLICY IF EXISTS "prayer_requests_read" ON prayer_requests;
CREATE POLICY "prayer_requests_read" ON prayer_requests
  FOR SELECT USING (
    auth.uid() = requester_id
    OR is_profile_viewer_or_above(profile_id)
    OR EXISTS (SELECT 1 FROM partners WHERE partners.profile_id = prayer_requests.profile_id AND partners.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "prayer_requests_owner_update" ON prayer_requests;
CREATE POLICY "prayer_requests_owner_update" ON prayer_requests
  FOR UPDATE USING (is_profile_owner(profile_id) OR auth.uid() = requester_id);

DROP POLICY IF EXISTS "prayer_requests_owner_delete" ON prayer_requests;
CREATE POLICY "prayer_requests_owner_delete" ON prayer_requests
  FOR DELETE USING (is_profile_owner(profile_id));

DROP POLICY IF EXISTS "categories_owner_all" ON transaction_categories;
CREATE POLICY "categories_owner_all" ON transaction_categories
  FOR ALL USING (is_profile_owner(profile_id));

DROP POLICY IF EXISTS "subscriptions_owner_read" ON subscriptions;
CREATE POLICY "subscriptions_owner_read" ON subscriptions
  FOR SELECT USING (is_profile_owner(profile_id));

DROP POLICY IF EXISTS "ai_credits_owner_all" ON ai_credit_transactions;
CREATE POLICY "ai_credits_owner_all" ON ai_credit_transactions
  FOR ALL USING (is_profile_owner(profile_id));

DROP POLICY IF EXISTS "whatsapp_config_owner_all" ON whatsapp_config;
CREATE POLICY "whatsapp_config_owner_all" ON whatsapp_config
  FOR ALL USING (is_profile_owner(profile_id));

DROP POLICY IF EXISTS "history_blocks_owner_all" ON history_blocks;
CREATE POLICY "history_blocks_owner_all" ON history_blocks
  FOR ALL USING (is_profile_owner(profile_id));

DROP POLICY IF EXISTS "history_blocks_public_read" ON history_blocks;
CREATE POLICY "history_blocks_public_read" ON history_blocks
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = history_blocks.profile_id AND profiles.privacy_mode = 'public')
    OR is_profile_viewer_or_above(profile_id)
    OR EXISTS (SELECT 1 FROM partners WHERE partners.profile_id = history_blocks.profile_id AND partners.user_id = auth.uid())
  );

-- ============================================================
-- Convite por e-mail (client não pode consultar auth.users direto).
-- Também aplica o limite de assentos pagos (planLimits.managersIncluded
-- + profiles.extra_manager_seats) — mesma ideia do limite de parceiros
-- em add-partner-button.tsx, mas garantida aqui no banco, já que este
-- é um recurso cobrado.
-- ============================================================
CREATE OR REPLACE FUNCTION invite_profile_manager(p_profile_id uuid, p_email text, p_role text DEFAULT 'manager')
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
  v_current_count integer;
  v_plan text;
  v_extra integer;
  v_included integer;
BEGIN
  IF NOT is_profile_owner(p_profile_id) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  IF p_role NOT IN ('manager', 'viewer') THEN
    RAISE EXCEPTION 'invalid_role';
  END IF;

  SELECT id INTO v_user_id FROM auth.users WHERE lower(email) = lower(p_email);
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'user_not_found';
  END IF;

  SELECT plan, extra_manager_seats INTO v_plan, v_extra FROM profiles WHERE id = p_profile_id;
  v_included := CASE v_plan WHEN 'pro' THEN 1 WHEN 'mission' THEN 2 ELSE 0 END;

  SELECT count(*) INTO v_current_count FROM profile_managers WHERE profile_id = p_profile_id;

  IF v_current_count >= (v_included + v_extra) THEN
    RAISE EXCEPTION 'seat_limit_reached';
  END IF;

  INSERT INTO profile_managers (profile_id, user_id, role, invited_by_user_id)
  VALUES (p_profile_id, v_user_id, p_role, auth.uid())
  ON CONFLICT (profile_id, user_id) DO UPDATE SET role = EXCLUDED.role;
END;
$$;
