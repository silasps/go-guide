-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- PROFILES
-- ============================================================
CREATE TABLE public.profiles (
  id                    UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id               UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  username              TEXT NOT NULL UNIQUE,
  display_name          TEXT NOT NULL,
  bio                   TEXT,
  location              TEXT,
  avatar_url            TEXT,
  cover_url             TEXT,
  privacy_mode          TEXT NOT NULL DEFAULT 'public' CHECK (privacy_mode IN ('public', 'private', 'stealth')),
  plan                  TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'mission')),
  stripe_customer_id    TEXT,
  accent_color          TEXT NOT NULL DEFAULT '#6366f1',
  website_url           TEXT,
  instagram_url         TEXT,
  youtube_url           TEXT,
  facebook_url          TEXT,
  tiktok_url            TEXT,
  pix_key               TEXT,
  paypal_url            TEXT,
  wise_url              TEXT,
  external_donation_url TEXT,
  ai_credits            INTEGER NOT NULL DEFAULT 0,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Stealth profiles get a random hash username prefix
CREATE UNIQUE INDEX idx_profiles_username ON profiles (LOWER(username));

-- ============================================================
-- POSTS
-- ============================================================
CREATE TABLE public.posts (
  id                  UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  profile_id          UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  type                TEXT NOT NULL CHECK (type IN ('text', 'image', 'video', 'carousel')),
  content             TEXT,
  media_urls          TEXT[] NOT NULL DEFAULT '{}',
  published_at        TIMESTAMPTZ,
  scheduled_at        TIMESTAMPTZ,
  is_draft            BOOLEAN NOT NULL DEFAULT true,
  created_by_user_id  UUID REFERENCES auth.users(id) NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_posts_profile_id ON posts (profile_id);
CREATE INDEX idx_posts_published_at ON posts (published_at DESC) WHERE published_at IS NOT NULL;

-- ============================================================
-- HIGHLIGHTS / CAMPAIGNS
-- ============================================================
CREATE TABLE public.highlights (
  id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  profile_id      UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  title           TEXT NOT NULL,
  description     TEXT,
  goal_amount     NUMERIC(15, 2),
  current_amount  NUMERIC(15, 2) NOT NULL DEFAULT 0,
  currency        TEXT NOT NULL DEFAULT 'BRL',
  cover_url       TEXT,
  is_featured     BOOLEAN NOT NULL DEFAULT false,
  order_index     INTEGER NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'hidden')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_highlights_profile_id ON highlights (profile_id);

-- ============================================================
-- PRAYER REQUESTS
-- ============================================================
CREATE TABLE public.prayer_requests (
  id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  profile_id      UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  requester_id    UUID REFERENCES auth.users(id) NOT NULL,
  requester_type  TEXT NOT NULL CHECK (requester_type IN ('missionary', 'partner')),
  content         TEXT NOT NULL,
  is_answered     BOOLEAN NOT NULL DEFAULT false,
  answered_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_prayer_requests_profile_id ON prayer_requests (profile_id);

-- ============================================================
-- PARTNERS (CRM)
-- ============================================================
CREATE TABLE public.partners (
  id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  profile_id  UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  user_id     UUID REFERENCES auth.users(id),
  name        TEXT NOT NULL,
  email       TEXT,
  phone       TEXT,
  type        TEXT NOT NULL DEFAULT 'both' CHECK (type IN ('financial', 'prayer', 'both')),
  notes       TEXT,
  tags        TEXT[] NOT NULL DEFAULT '{}',
  joined_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_partners_profile_id ON partners (profile_id);
CREATE INDEX idx_partners_user_id ON partners (user_id) WHERE user_id IS NOT NULL;

-- ============================================================
-- FINANCIAL ACCOUNTS
-- ============================================================
CREATE TABLE public.financial_accounts (
  id                  UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  profile_id          UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  currency_code       TEXT NOT NULL,
  name                TEXT NOT NULL,
  balance             NUMERIC(15, 2) NOT NULL DEFAULT 0,
  account_type        TEXT NOT NULL DEFAULT 'checking' CHECK (account_type IN ('checking', 'savings', 'credit')),
  credit_limit        NUMERIC(15, 2),
  is_shared           BOOLEAN NOT NULL DEFAULT false,
  created_by_user_id  UUID REFERENCES auth.users(id) NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_financial_accounts_profile_id ON financial_accounts (profile_id);

-- ============================================================
-- ACCOUNT MEMBERS (family sharing)
-- ============================================================
CREATE TABLE public.account_members (
  id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  account_id  UUID REFERENCES financial_accounts(id) ON DELETE CASCADE NOT NULL,
  user_id     UUID REFERENCES auth.users(id) NOT NULL,
  role        TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('owner', 'viewer')),
  added_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (account_id, user_id)
);

-- ============================================================
-- TRANSACTION CATEGORIES
-- ============================================================
CREATE TABLE public.transaction_categories (
  id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  profile_id  UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  name        TEXT NOT NULL,
  icon        TEXT,
  color       TEXT,
  parent_id   UUID REFERENCES transaction_categories(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_categories_profile_id ON transaction_categories (profile_id);

-- ============================================================
-- TRANSACTIONS
-- ============================================================
CREATE TABLE public.transactions (
  id                  UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  account_id          UUID REFERENCES financial_accounts(id) ON DELETE CASCADE NOT NULL,
  profile_id          UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  created_by_user_id  UUID REFERENCES auth.users(id) NOT NULL,
  type                TEXT NOT NULL CHECK (type IN ('income', 'expense', 'transfer')),
  amount              NUMERIC(15, 2) NOT NULL,
  currency            TEXT NOT NULL,
  description         TEXT NOT NULL,
  category_id         UUID REFERENCES transaction_categories(id) ON DELETE SET NULL,
  subcategory_id      UUID REFERENCES transaction_categories(id) ON DELETE SET NULL,
  partner_id          UUID REFERENCES partners(id) ON DELETE SET NULL,
  source              TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'whatsapp', 'api')),
  is_credit_purchase  BOOLEAN NOT NULL DEFAULT false,
  due_date            DATE,
  date                DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_transactions_profile_id ON transactions (profile_id);
CREATE INDEX idx_transactions_account_id ON transactions (account_id);
CREATE INDEX idx_transactions_date ON transactions (date DESC);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
CREATE TABLE public.notifications (
  id                  UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  recipient_user_id   UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type                TEXT NOT NULL,
  payload             JSONB NOT NULL DEFAULT '{}',
  read_at             TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_recipient ON notifications (recipient_user_id, read_at);

-- ============================================================
-- MESSAGES
-- ============================================================
CREATE TABLE public.messages (
  id            UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  sender_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  recipient_id  UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  profile_id    UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  content       TEXT NOT NULL,
  is_encrypted  BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_messages_sender ON messages (sender_id);
CREATE INDEX idx_messages_recipient ON messages (recipient_id);

-- ============================================================
-- SUBSCRIPTIONS
-- ============================================================
CREATE TABLE public.subscriptions (
  id                      UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  profile_id              UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL UNIQUE,
  stripe_subscription_id  TEXT NOT NULL UNIQUE,
  plan                    TEXT NOT NULL CHECK (plan IN ('free', 'pro', 'mission')),
  status                  TEXT NOT NULL,
  current_period_end      TIMESTAMPTZ NOT NULL,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- AI CREDIT TRANSACTIONS
-- ============================================================
CREATE TABLE public.ai_credit_transactions (
  id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  profile_id  UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  amount      INTEGER NOT NULL,
  reason      TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ai_credits_profile_id ON ai_credit_transactions (profile_id);

-- ============================================================
-- WHATSAPP CONFIG
-- ============================================================
CREATE TABLE public.whatsapp_config (
  id                    UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  profile_id            UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL UNIQUE,
  phone_number_id       TEXT,
  verify_token          TEXT,
  notifications_enabled BOOLEAN NOT NULL DEFAULT false,
  financial_enabled     BOOLEAN NOT NULL DEFAULT false,
  is_verified           BOOLEAN NOT NULL DEFAULT false,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- HISTORY BLOCKS (Notion-like blocks for /historia page)
-- ============================================================
CREATE TABLE public.history_blocks (
  id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  profile_id  UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('who_we_are', 'our_calling', 'timeline', 'cta', 'text')),
  content     JSONB NOT NULL DEFAULT '{}',
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_history_blocks_profile_id ON history_blocks (profile_id);

-- ============================================================
-- EXCHANGE RATE CACHE
-- ============================================================
CREATE TABLE public.exchange_rates (
  id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  base        TEXT NOT NULL,
  rates       JSONB NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (base)
);

-- ============================================================
-- TRIGGERS: updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON posts FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON highlights FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON financial_accounts FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON subscriptions FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON history_blocks FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- TRIGGER: auto-update account balance on transaction
-- ============================================================
CREATE OR REPLACE FUNCTION update_account_balance()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.type = 'income' THEN
      UPDATE financial_accounts SET balance = balance + NEW.amount WHERE id = NEW.account_id;
    ELSIF NEW.type = 'expense' THEN
      UPDATE financial_accounts SET balance = balance - NEW.amount WHERE id = NEW.account_id;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.type = 'income' THEN
      UPDATE financial_accounts SET balance = balance - OLD.amount WHERE id = OLD.account_id;
    ELSIF OLD.type = 'expense' THEN
      UPDATE financial_accounts SET balance = balance + OLD.amount WHERE id = OLD.account_id;
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_balance
  AFTER INSERT OR DELETE ON transactions
  FOR EACH ROW EXECUTE FUNCTION update_account_balance();

-- ============================================================
-- TRIGGER: auto-create profile on user signup
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, username, display_name)
  VALUES (
    NEW.id,
    LOWER(SPLIT_PART(NEW.email, '@', 1)) || '_' || SUBSTR(NEW.id::TEXT, 1, 6),
    COALESCE(NEW.raw_user_meta_data->>'full_name', SPLIT_PART(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
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
