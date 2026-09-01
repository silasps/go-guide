-- ============================================================
-- Corrige duas fragilidades na RLS de mensagens/E2EE encontradas em revisão
-- de segurança (2026-09-01).
-- ============================================================

-- ------------------------------------------------------------
-- 1) MESSAGES: "messages_participants_all" (002) usava a mesma condição
-- (sender_id OU recipient_id = auth.uid()) para TODAS as operações,
-- inclusive INSERT. Como o Postgres usa a expressão USING como WITH CHECK
-- quando não há um WITH CHECK explícito, qualquer usuário autenticado
-- conseguia inserir uma mensagem com sender_id = ID de OUTRA pessoa,
-- bastando que recipient_id = o próprio auth.uid() — bastava chamar
-- supabase.from('messages').insert(...) direto pelo client (sem passar
-- pela UI) para forjar uma mensagem "recebida de" qualquer usuário, com
-- texto arbitrário em claro (is_encrypted=false). Risco de phishing/
-- engenharia social dentro do próprio app (ex.: forjar um pedido de Pix
-- "vindo" do missionário que a pessoa apoia).
--
-- Corrige separando as policies: INSERT exige sender_id = auth.uid();
-- SELECT continua permitindo os dois participantes lerem. UPDATE é
-- removido (nenhum fluxo do app atualiza mensagens; mantê-lo só dava a
-- qualquer um dos dois lados poder reescrever conteúdo/timestamp depois
-- do envio). DELETE mantém o comportamento anterior (qualquer um dos
-- participantes pode apagar sua cópia da conversa).
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "messages_participants_all" ON messages;

CREATE POLICY "messages_participants_select" ON messages
  FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

CREATE POLICY "messages_sender_insert" ON messages
  FOR INSERT WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "messages_participants_delete" ON messages
  FOR DELETE USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

-- ------------------------------------------------------------
-- 2) ENCRYPTED_DEK_GRANTS: INSERT/UPDATE aceitavam qualquer usuário
-- autenticado (`auth.uid() IS NOT NULL`), sem checar relação nenhuma com
-- o recurso. Isso não quebra a confidencialidade em si — sem conhecer a
-- DEK de verdade, ninguém consegue forjar um wrapped_dek que abra de
-- verdade (crypto_box_seal exige a chave pública do destinatário E o
-- segredo original) — mas permite:
--   a) UPDATE: revogar (revoked_at) ou corromper (wrapped_dek) o grant de
--      QUALQUER outra pessoa em QUALQUER recurso, mesmo sem nenhuma
--      relação com ele — nega acesso de forma silenciosa (a UI só mostra
--      "Não foi possível decifrar esta mensagem.", sem alarme).
--   b) INSERT: como resource_id de conversa é um hash determinístico
--      (profile_id + os dois user_ids, sem segredo — ver
--      src/lib/crypto/conversation.ts) computável por qualquer client,
--      dá pra "reservar" a linha (resource_type, resource_id,
--      grantee_user_id) de outra pessoa ANTES da conversa real existir,
--      bloqueando pra sempre o grant de verdade (colide com a UNIQUE
--      constraint, e o app ignora erro 23505 silenciosamente).
--
-- Restringe as duas: só quem já tem grant ativo no recurso (mesmo
-- critério do "self-healing" da policy de SELECT) pode inserir/atualizar
-- grants nele, além do caso de auto-concessão (bootstrap da própria
-- linha ao criar um recurso novo). Isso fecha de vez o vetor de UPDATE
-- (a), que era o mais direto. O vetor de INSERT (b) via auto-grant de
-- bootstrap ainda existe de forma mais restrita (só quem já colocou uma
-- linha própria no recurso "de mentirinha" primeiro) — fechar
-- completamente exigiria validar, no banco, que o resource_id
-- corresponde a uma conversa/pedido real entre as partes, o que fica
-- para uma revisão futura dedicada a isso.
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "encrypted_dek_grants_insert_authenticated" ON encrypted_dek_grants;
CREATE POLICY "encrypted_dek_grants_insert_scoped" ON encrypted_dek_grants
  FOR INSERT WITH CHECK (
    grantee_user_id = auth.uid()
    OR has_dek_grant(resource_type, resource_id)
  );

DROP POLICY IF EXISTS "encrypted_dek_grants_update_authenticated" ON encrypted_dek_grants;
CREATE POLICY "encrypted_dek_grants_update_scoped" ON encrypted_dek_grants
  FOR UPDATE USING (
    grantee_user_id = auth.uid()
    OR has_dek_grant(resource_type, resource_id)
  )
  WITH CHECK (
    grantee_user_id = auth.uid()
    OR has_dek_grant(resource_type, resource_id)
  );
