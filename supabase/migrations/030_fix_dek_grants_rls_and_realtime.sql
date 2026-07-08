-- ============================================================
-- Corrige drift entre as migrations 015/018 e o estado real do banco:
-- as políticas de encrypted_dek_grants em produção eram mais restritivas
-- do que este arquivo já descrevia (o INSERT só permitia grantee=self, e
-- a policy de SELECT de 018 nunca tinha sido aplicada) — descoberto ao
-- depurar mensagens que nunca chegavam a ser lidas pelo destinatário.
-- Reaplica as duas de forma idempotente (DROP IF EXISTS + CREATE).
-- ============================================================
DROP POLICY IF EXISTS "encrypted_dek_grants_insert_authenticated" ON encrypted_dek_grants;
CREATE POLICY "encrypted_dek_grants_insert_authenticated" ON encrypted_dek_grants
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "encrypted_dek_grants_update_authenticated" ON encrypted_dek_grants;
CREATE POLICY "encrypted_dek_grants_update_authenticated" ON encrypted_dek_grants
  FOR UPDATE USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- Política antiga (015) restringia UPDATE a resource_type='profile_sensitive_fields',
-- bloqueando silenciosamente qualquer upsert em grants de 'conversation'/'prayer_request'.
DROP POLICY IF EXISTS "encrypted_dek_grants_revoke_by_creator" ON encrypted_dek_grants;

CREATE OR REPLACE FUNCTION has_dek_grant(p_resource_type text, p_resource_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM encrypted_dek_grants
    WHERE resource_type = p_resource_type
      AND resource_id = p_resource_id
      AND grantee_user_id = auth.uid()
      AND revoked_at IS NULL
  );
$$;

DROP POLICY IF EXISTS "encrypted_dek_grants_grantee_read" ON encrypted_dek_grants;
CREATE POLICY "encrypted_dek_grants_grantee_read" ON encrypted_dek_grants
  FOR SELECT USING (
    auth.uid() = grantee_user_id
    OR has_dek_grant(resource_type, resource_id)
  );

-- ============================================================
-- messages nunca tinha sido adicionada à publicação supabase_realtime —
-- o MessageThread já assinava postgres_changes, mas o evento nunca
-- disparava, então uma resposta só aparecia recarregando a página.
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  END IF;
END $$;
