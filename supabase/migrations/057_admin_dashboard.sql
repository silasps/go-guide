-- ============================================================
-- Suporte ao dashboard do superadmin: gênero (autodeclarado, opcional,
-- pergunta nova no onboarding/cadastro) e timestamps de quando
-- verification_status/account_status mudaram (pra calcular "há quantos
-- dias está pendente" sem depender de updated_at, que muda em qualquer
-- edição de perfil, não só em mudança de status).
-- ============================================================

ALTER TABLE profiles
  ADD COLUMN gender TEXT NOT NULL DEFAULT 'unspecified'
    CHECK (gender IN ('male', 'female', 'unspecified')),
  ADD COLUMN verification_requested_at TIMESTAMPTZ,
  ADD COLUMN account_status_changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Backfill dos 17 perfis existentes hoje (todos de teste, exceto Johnson/
-- Silas/Izabela, confirmados reais pelo usuário) — inferido pelo nome
-- cadastrado, a pedido explícito do usuário. Perfis de organização/família/
-- casal ou sem nome de pessoa real ficam 'unspecified' (default, não
-- listados abaixo).
UPDATE profiles SET gender = 'male' WHERE id IN (
  'e5cad98c-c441-4f32-8e0f-2aa46c076db4', -- João Missionário Teste
  'fc8701d7-ded3-4bab-a2f2-b3e9beb080da', -- José teste
  '8e4026b2-1d30-4920-ab55-05a35b330801', -- Juan
  'af461665-681a-40b1-a1e7-856ee3530920', -- Johnson
  '13950911-81e9-492e-8726-733a1e830395', -- Carlos Mendes
  '08a9231c-19a2-45b2-8298-786fda2acf5d', -- Rafael Lima
  'b6cb40bf-f658-4323-b9f2-2123c0560472'  -- Silas teste
);
UPDATE profiles SET gender = 'female' WHERE id IN (
  '21aaaca7-c193-4175-87ee-d625490b9ee7', -- Ana Ferreira
  'dd966722-9e00-4d78-86b9-4615c9e35661', -- Beatriz Santos
  '1cc44196-e914-4ad4-8da9-382126cfb9cb', -- Camila Rocha
  'df700060-2899-4b40-bfd6-14fb647f615b'  -- Izabela Cristina de Souza Silva
);

-- Quem já está pendente hoje (se houver) ganha a data de agora como
-- "desde quando" — não temos o momento real em que virou pending, mas é
-- a melhor aproximação disponível retroativamente.
UPDATE profiles SET verification_requested_at = NOW() WHERE verification_status = 'pending';
