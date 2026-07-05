-- ============================================================
-- E2EE — mensagens, pedidos de oração privados e campos sensíveis
-- do perfil. Chave pública por usuário + DEK (Data Encryption Key)
-- cifrada separadamente por destinatário autorizado (key-wrapping),
-- permitindo revogar 1 pessoa sem recifrar para as demais.
-- O servidor nunca vê texto claro nem consegue decifrar sozinho.
-- ============================================================
CREATE TABLE public.user_encryption_keys (
  user_id               UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  public_key            TEXT NOT NULL,
  encrypted_private_key TEXT NOT NULL,
  kdf_salt              TEXT NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.encrypted_dek_grants (
  id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  resource_type   TEXT NOT NULL CHECK (resource_type IN ('conversation', 'prayer_request', 'profile_sensitive_fields')),
  resource_id     UUID NOT NULL,
  grantee_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  wrapped_dek     TEXT NOT NULL,
  revoked_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (resource_type, resource_id, grantee_user_id)
);

CREATE INDEX idx_encrypted_dek_grants_resource ON encrypted_dek_grants (resource_type, resource_id);
CREATE INDEX idx_encrypted_dek_grants_grantee ON encrypted_dek_grants (grantee_user_id) WHERE revoked_at IS NULL;

CREATE TABLE public.profile_sensitive_data (
  profile_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  ciphertext TEXT NOT NULL,
  nonce      TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.prayer_request_replies (
  id                UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  prayer_request_id UUID REFERENCES prayer_requests(id) ON DELETE CASCADE NOT NULL,
  author_user_id    UUID REFERENCES auth.users(id) NOT NULL,
  ciphertext        TEXT,
  nonce             TEXT,
  content           TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_prayer_request_replies_request_id ON prayer_request_replies (prayer_request_id);

ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS nonce TEXT;
ALTER TABLE public.prayer_requests
  ADD COLUMN IF NOT EXISTS is_private BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS nonce TEXT;

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE public.user_encryption_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.encrypted_dek_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_sensitive_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prayer_request_replies ENABLE ROW LEVEL SECURITY;

-- Qualquer usuário autenticado pode publicar/ler sua própria chave pública
-- (a leitura da chave pública de terceiros é necessária para cifrar DEKs para eles).
CREATE POLICY "user_encryption_keys_read_all_authenticated" ON user_encryption_keys
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "user_encryption_keys_owner_write" ON user_encryption_keys
  FOR ALL USING (auth.uid() = user_id);

-- Grants: o dono do recurso (quem cifrou) insere; o destinatário lê o seu.
CREATE POLICY "encrypted_dek_grants_grantee_read" ON encrypted_dek_grants
  FOR SELECT USING (auth.uid() = grantee_user_id);

CREATE POLICY "encrypted_dek_grants_insert_authenticated" ON encrypted_dek_grants
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "encrypted_dek_grants_revoke_by_creator" ON encrypted_dek_grants
  FOR UPDATE USING (
    resource_type = 'profile_sensitive_fields'
    AND is_profile_owner(resource_id)
  );

CREATE POLICY "profile_sensitive_data_owner_all" ON profile_sensitive_data
  FOR ALL USING (is_profile_owner(profile_id));

CREATE POLICY "profile_sensitive_data_grantee_read" ON profile_sensitive_data
  FOR SELECT USING (has_partner_grant(profile_id, 'sensitive_fields'));

CREATE POLICY "prayer_request_replies_read" ON prayer_request_replies
  FOR SELECT USING (
    auth.uid() = author_user_id
    OR EXISTS (
      SELECT 1 FROM prayer_requests pr
      WHERE pr.id = prayer_request_replies.prayer_request_id
        AND (pr.requester_id = auth.uid() OR is_profile_owner(pr.profile_id))
    )
  );

CREATE POLICY "prayer_request_replies_insert" ON prayer_request_replies
  FOR INSERT WITH CHECK (
    auth.uid() = author_user_id
    AND EXISTS (
      SELECT 1 FROM prayer_requests pr
      WHERE pr.id = prayer_request_replies.prayer_request_id
        AND (pr.requester_id = auth.uid() OR is_profile_owner(pr.profile_id))
    )
  );

-- Resposta a pedido de oração -> notifica o outro lado da conversa
CREATE OR REPLACE FUNCTION trg_fn_notify_prayer_reply()
RETURNS TRIGGER AS $$
DECLARE
  v_profile_owner uuid;
  v_requester uuid;
  v_recipient uuid;
BEGIN
  SELECT p.user_id, pr.requester_id INTO v_profile_owner, v_requester
  FROM prayer_requests pr JOIN profiles p ON p.id = pr.profile_id
  WHERE pr.id = NEW.prayer_request_id;

  v_recipient := CASE WHEN NEW.author_user_id = v_profile_owner THEN v_requester ELSE v_profile_owner END;
  PERFORM notify(v_recipient, 'prayer_reply', jsonb_build_object('prayer_request_id', NEW.prayer_request_id, 'reply_id', NEW.id));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_notify_prayer_reply
  AFTER INSERT ON prayer_request_replies
  FOR EACH ROW EXECUTE FUNCTION trg_fn_notify_prayer_reply();
