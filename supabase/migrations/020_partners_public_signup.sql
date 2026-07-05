-- ============================================================
-- Corrige gap de RLS pré-existente: a página pública "Seja Parceiro"
-- (/[username]/parceria) insere diretamente em `partners` a partir do
-- lado do parceiro (autenticado ou anônimo), mas só existia a policy
-- "partners_owner_all" (USING is_profile_owner), que exige ser o
-- próprio missionário — ninguém além dele conseguia se auto-cadastrar.
-- Isso nunca tinha sido exercitado de ponta a ponta antes desta sessão.
-- ============================================================
CREATE POLICY "partners_public_signup" ON partners
  FOR INSERT WITH CHECK (true);
