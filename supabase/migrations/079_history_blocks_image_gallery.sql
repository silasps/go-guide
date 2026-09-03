-- "Quem somos" e "Nosso chamado" trocam de 1 imagem única (image_url +
-- image_caption) para uma galeria de fotos (content.images: string[]).
-- Migra os blocos que já tinham image_url preenchido (inclui o seed da
-- 065_history_example_images.sql) para o novo formato.
UPDATE history_blocks
SET content = (content - 'image_url' - 'image_caption')
  || jsonb_build_object('images', jsonb_build_array(content->>'image_url'))
WHERE type IN ('who_we_are', 'our_calling') AND content ? 'image_url';
