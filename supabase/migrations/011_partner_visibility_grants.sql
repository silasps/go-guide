-- ============================================================
-- Grants de visibilidade por parceiro + correção do gap de RLS
-- (parceiros ainda não conseguiam ver perfis private/stealth,
-- deixado pendente desde a migration 004)
-- ============================================================
CREATE TABLE public.partner_visibility_grants (
  id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  profile_id  UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  partner_id  UUID REFERENCES partners(id) ON DELETE CASCADE NOT NULL,
  section     TEXT NOT NULL CHECK (section IN ('full_profile', 'financial_summary', 'prayer_requests', 'sensitive_fields', 'messages')),
  granted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (profile_id, partner_id, section)
);

CREATE INDEX idx_partner_visibility_grants_profile_id ON partner_visibility_grants (profile_id);
CREATE INDEX idx_partner_visibility_grants_partner_id ON partner_visibility_grants (partner_id);

ALTER TABLE public.partner_visibility_grants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "partner_visibility_grants_owner_all" ON partner_visibility_grants
  FOR ALL USING (is_profile_owner(profile_id));

CREATE POLICY "partner_visibility_grants_partner_read" ON partner_visibility_grants
  FOR SELECT USING (
    partner_id IN (SELECT id FROM partners WHERE user_id = auth.uid())
  );

-- ============================================================
-- Função SECURITY DEFINER para checar se o usuário atual é um
-- parceiro autorizado deste perfil, sem reintroduzir a recursão
-- profiles -> partners -> profiles corrigida na migration 004.
-- ============================================================
CREATE OR REPLACE FUNCTION is_authorized_partner(p_profile_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM partners
    WHERE partners.profile_id = p_profile_id
      AND partners.user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION has_partner_grant(p_profile_id uuid, p_section text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM partner_visibility_grants g
    JOIN partners p ON p.id = g.partner_id
    WHERE g.profile_id = p_profile_id
      AND g.section = p_section
      AND p.user_id = auth.uid()
  );
$$;

-- ============================================================
-- Reaplicar profiles_public_read agora permitindo parceiros
-- autorizados acessarem perfis private/stealth.
-- ============================================================
DROP POLICY IF EXISTS "profiles_public_read" ON profiles;

CREATE POLICY "profiles_public_read" ON profiles
  FOR SELECT USING (
    privacy_mode = 'public'
    OR auth.uid() = user_id
    OR (privacy_mode IN ('private', 'stealth') AND is_authorized_partner(id))
  );

-- Mesma técnica (troca de subquery direta em partners pela função
-- SECURITY DEFINER) em highlights/posts/prayer_requests, para evitar
-- reintroduzir recursão se partners algum dia checar profiles de novo.
DROP POLICY IF EXISTS "highlights_public_read" ON highlights;
CREATE POLICY "highlights_public_read" ON highlights
  FOR SELECT USING (
    status = 'active'
    AND (
      EXISTS (SELECT 1 FROM profiles WHERE profiles.id = highlights.profile_id AND profiles.privacy_mode = 'public')
      OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = highlights.profile_id AND profiles.user_id = auth.uid())
      OR is_authorized_partner(highlights.profile_id)
    )
  );

DROP POLICY IF EXISTS "posts_public_read" ON posts;
CREATE POLICY "posts_public_read" ON posts
  FOR SELECT USING (
    published_at IS NOT NULL
    AND is_draft = false
    AND (
      EXISTS (SELECT 1 FROM profiles WHERE profiles.id = posts.profile_id AND profiles.privacy_mode = 'public')
      OR auth.uid() = created_by_user_id
      OR is_authorized_partner(posts.profile_id)
    )
  );

DROP POLICY IF EXISTS "prayer_requests_read" ON prayer_requests;
CREATE POLICY "prayer_requests_read" ON prayer_requests
  FOR SELECT USING (
    auth.uid() = requester_id
    OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = prayer_requests.profile_id AND profiles.user_id = auth.uid())
    OR is_authorized_partner(prayer_requests.profile_id)
  );
