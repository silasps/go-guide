-- Distinção de papel: parceiro/apoiador vs. missionário/organização.
-- Default 'partner' (papel mais leve) para novos cadastros — handle_new_user()
-- não precisa mudar, o DEFAULT da coluna já cobre.
ALTER TABLE profiles
  ADD COLUMN user_role TEXT NOT NULL DEFAULT 'partner'
  CHECK (user_role IN ('partner', 'missionary'));

-- Backfill: quem já tem projeto, post publicado ou parceiros cadastrados é
-- inequivocamente missionário. Perfis vazios ficam em 'partner' (default
-- mais seguro, nunca bloqueia).
UPDATE profiles SET user_role = 'missionary'
WHERE id IN (
  SELECT DISTINCT profile_id FROM highlights
  UNION
  SELECT DISTINCT profile_id FROM posts WHERE is_draft = false
  UNION
  SELECT DISTINCT profile_id FROM partners
);
