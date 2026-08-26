-- ============================================================
-- Troca "16:9" por "1.91:1" como proporção de paisagem em posts —
-- 1.91:1 é a proporção exata que o Instagram usa (16:9 = 1.78:1 é só
-- aproximado). Nenhum post em produção usava '16:9' até agora, então
-- não precisa de backfill de dados, só atualizar a constraint.
-- ============================================================
ALTER TABLE posts DROP CONSTRAINT IF EXISTS posts_media_aspect_ratio_check;
ALTER TABLE posts ADD CONSTRAINT posts_media_aspect_ratio_check
  CHECK (media_aspect_ratio IN ('original', '1:1', '4:5', '1.91:1'));
