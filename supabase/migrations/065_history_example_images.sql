-- ============================================================
-- Exemplo temporário: adiciona uma imagem em cada seção narrativa
-- (who_we_are, our_calling) da história da Família Silva, usando fotos
-- que já existem no próprio sistema dela (posts/capa de projeto) — só
-- pra servir de referência visual, o usuário ajusta depois pelo editor.
-- ============================================================
UPDATE history_blocks
SET content = content || jsonb_build_object(
  'image_url', 'https://eqnekupeiehgkacegmgl.supabase.co/storage/v1/object/public/media/901ef91b-ad9d-4301-8394-73861c97757a/1780882962504-0.webp',
  'image_caption', 'Tempo em família — o que nos move a servir'
)
WHERE type = 'who_we_are'
  AND profile_id = (SELECT id FROM profiles WHERE username = 'familia-silva');

UPDATE history_blocks
SET content = content || jsonb_build_object(
  'image_url', 'https://eqnekupeiehgkacegmgl.supabase.co/storage/v1/object/public/media/901ef91b-ad9d-4301-8394-73861c97757a/highlights/50862e12-196a-4db2-aea5-9dff425f2154.webp',
  'image_caption', 'Construindo a base que sustenta o chamado'
)
WHERE type = 'our_calling'
  AND profile_id = (SELECT id FROM profiles WHERE username = 'familia-silva');
