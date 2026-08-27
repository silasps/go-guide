-- ============================================================
-- Corrige a policy de INSERT pública em `pledges` — reportado pelo
-- usuário: "Erro ao registrar oferta" ao tentar registrar um Pix
-- manual anônimo. A causa não é código (o app já envia os campos
-- certos), é a policy `pledges_insert_public` (migration 012) não
-- estar presente no banco remoto — reaplicada aqui de forma
-- idempotente (DROP IF EXISTS + CREATE) pra corrigir sem depender de
-- reconstruir o histórico de migrations do zero.
-- ============================================================
DROP POLICY IF EXISTS "pledges_insert_public" ON pledges;

CREATE POLICY "pledges_insert_public" ON pledges
  FOR INSERT WITH CHECK (true);
