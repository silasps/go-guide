-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE highlights ENABLE ROW LEVEL SECURITY;
ALTER TABLE prayer_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE history_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE exchange_rates ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- PROFILES
-- ============================================================
-- Public profiles readable by everyone (except stealth)
CREATE POLICY "profiles_public_read" ON profiles
  FOR SELECT USING (
    privacy_mode = 'public'
    OR auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM partners WHERE partners.profile_id = profiles.id AND partners.user_id = auth.uid())
  );

CREATE POLICY "profiles_owner_all" ON profiles
  FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- POSTS
-- ============================================================
CREATE POLICY "posts_public_read" ON posts
  FOR SELECT USING (
    published_at IS NOT NULL
    AND is_draft = false
    AND (
      EXISTS (SELECT 1 FROM profiles WHERE profiles.id = posts.profile_id AND profiles.privacy_mode = 'public')
      OR auth.uid() = created_by_user_id
      OR EXISTS (SELECT 1 FROM partners WHERE partners.profile_id = posts.profile_id AND partners.user_id = auth.uid())
    )
  );

CREATE POLICY "posts_owner_all" ON posts
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = posts.profile_id AND profiles.user_id = auth.uid())
  );

-- ============================================================
-- HIGHLIGHTS
-- ============================================================
CREATE POLICY "highlights_public_read" ON highlights
  FOR SELECT USING (
    status = 'active'
    AND (
      EXISTS (SELECT 1 FROM profiles WHERE profiles.id = highlights.profile_id AND profiles.privacy_mode = 'public')
      OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = highlights.profile_id AND profiles.user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM partners WHERE partners.profile_id = highlights.profile_id AND partners.user_id = auth.uid())
    )
  );

CREATE POLICY "highlights_owner_all" ON highlights
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = highlights.profile_id AND profiles.user_id = auth.uid())
  );

-- ============================================================
-- PRAYER REQUESTS
-- ============================================================
CREATE POLICY "prayer_requests_read" ON prayer_requests
  FOR SELECT USING (
    auth.uid() = requester_id
    OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = prayer_requests.profile_id AND profiles.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM partners WHERE partners.profile_id = prayer_requests.profile_id AND partners.user_id = auth.uid())
  );

CREATE POLICY "prayer_requests_insert_authenticated" ON prayer_requests
  FOR INSERT WITH CHECK (auth.uid() = requester_id);

CREATE POLICY "prayer_requests_owner_update" ON prayer_requests
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = prayer_requests.profile_id AND profiles.user_id = auth.uid())
    OR auth.uid() = requester_id
  );

CREATE POLICY "prayer_requests_owner_delete" ON prayer_requests
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = prayer_requests.profile_id AND profiles.user_id = auth.uid())
  );

-- ============================================================
-- PARTNERS
-- ============================================================
CREATE POLICY "partners_owner_all" ON partners
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = partners.profile_id AND profiles.user_id = auth.uid())
  );

CREATE POLICY "partners_self_read" ON partners
  FOR SELECT USING (auth.uid() = user_id);

-- ============================================================
-- FINANCIAL ACCOUNTS
-- ============================================================
CREATE POLICY "financial_accounts_owner_all" ON financial_accounts
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = financial_accounts.profile_id AND profiles.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM account_members WHERE account_members.account_id = financial_accounts.id AND account_members.user_id = auth.uid())
  );

-- ============================================================
-- ACCOUNT MEMBERS
-- ============================================================
CREATE POLICY "account_members_owner_all" ON account_members
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM financial_accounts
      JOIN profiles ON profiles.id = financial_accounts.profile_id
      WHERE financial_accounts.id = account_members.account_id
        AND profiles.user_id = auth.uid()
    )
    OR auth.uid() = account_members.user_id
  );

-- ============================================================
-- TRANSACTION CATEGORIES
-- ============================================================
CREATE POLICY "categories_owner_all" ON transaction_categories
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = transaction_categories.profile_id AND profiles.user_id = auth.uid())
  );

-- ============================================================
-- TRANSACTIONS
-- ============================================================
CREATE POLICY "transactions_owner_all" ON transactions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = transactions.profile_id AND profiles.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM account_members WHERE account_members.account_id = transactions.account_id AND account_members.user_id = auth.uid())
  );

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
CREATE POLICY "notifications_recipient_all" ON notifications
  FOR ALL USING (auth.uid() = recipient_user_id);

-- ============================================================
-- MESSAGES
-- ============================================================
CREATE POLICY "messages_participants_all" ON messages
  FOR ALL USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

-- ============================================================
-- SUBSCRIPTIONS
-- ============================================================
CREATE POLICY "subscriptions_owner_read" ON subscriptions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = subscriptions.profile_id AND profiles.user_id = auth.uid())
  );

-- ============================================================
-- AI CREDIT TRANSACTIONS
-- ============================================================
CREATE POLICY "ai_credits_owner_all" ON ai_credit_transactions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = ai_credit_transactions.profile_id AND profiles.user_id = auth.uid())
  );

-- ============================================================
-- WHATSAPP CONFIG
-- ============================================================
CREATE POLICY "whatsapp_config_owner_all" ON whatsapp_config
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = whatsapp_config.profile_id AND profiles.user_id = auth.uid())
  );

-- ============================================================
-- HISTORY BLOCKS
-- ============================================================
CREATE POLICY "history_blocks_public_read" ON history_blocks
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = history_blocks.profile_id AND profiles.privacy_mode = 'public')
    OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = history_blocks.profile_id AND profiles.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM partners WHERE partners.profile_id = history_blocks.profile_id AND partners.user_id = auth.uid())
  );

CREATE POLICY "history_blocks_owner_all" ON history_blocks
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = history_blocks.profile_id AND profiles.user_id = auth.uid())
  );

-- ============================================================
-- EXCHANGE RATES (readable by all authenticated)
-- ============================================================
CREATE POLICY "exchange_rates_read" ON exchange_rates
  FOR SELECT USING (true);

CREATE POLICY "exchange_rates_service_write" ON exchange_rates
  FOR ALL USING (auth.role() = 'service_role');
