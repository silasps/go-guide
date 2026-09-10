-- ============================================================
-- Remove a galeria de fotos do projeto (migration 045) por completo —
-- a pedido do usuário, os posts vinculados ao projeto (`posts.project_id`,
-- exibidos em "Atualizações") já bastam pra mostrar fotos do progresso,
-- sem precisar de uma seção separada só pra isso. Dados existentes eram
-- só de teste (confirmado com o usuário antes de apagar).
-- ============================================================
DROP TABLE IF EXISTS public.project_gallery_images;

NOTIFY pgrst, 'reload schema';
