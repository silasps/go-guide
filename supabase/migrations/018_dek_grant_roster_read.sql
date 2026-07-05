-- ============================================================
-- Permite que quem já tem acesso a um recurso E2EE (conversa/pedido de
-- oração/campo sensível) veja QUEM MAIS tem grant para o mesmo recurso
-- (só o `grantee_user_id`, nunca o `wrapped_dek` de outra pessoa — cada
-- linha só é decifrável pela chave privada do próprio dono).
--
-- Necessário para o "self-healing" de grants: quando alguém configura a
-- criptografia DEPOIS da primeira mensagem/pedido, o próximo envio detecta
-- que falta o grant dela e cria, sem precisar recifrar nada para quem já tinha acesso.
-- ============================================================
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
-- Faltava uma policy de UPDATE. O app usa upsert (INSERT ... ON
-- CONFLICT DO UPDATE) para conceder acesso — o Postgres exige permissão
-- para os dois caminhos da instrução mesmo quando não há conflito de
-- verdade, senão a instrução inteira falha com 42501/403. Mesmo nível de
-- confiança já aceito na policy de INSERT (auth.uid() IS NOT NULL): quem
-- concede acesso a alguém já tinha essa mesma liberdade via INSERT.
-- ============================================================
CREATE POLICY "encrypted_dek_grants_update_authenticated" ON encrypted_dek_grants
  FOR UPDATE USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
