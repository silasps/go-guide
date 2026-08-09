-- ============================================================
-- Galeria de fotos do projeto — imagens avulsas que representam o
-- projeto (ex.: fotos do terreno, do progresso da obra), separadas
-- tanto da capa única (`highlights.cover_url`) quanto dos posts
-- vinculados via `posts.project_id` (que já aparecem em "Atualizações").
-- ============================================================
CREATE TABLE public.project_gallery_images (
  id           UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  highlight_id UUID REFERENCES highlights(id) ON DELETE CASCADE NOT NULL,
  image_url    TEXT NOT NULL,
  order_index  INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_project_gallery_images_highlight_id ON project_gallery_images (highlight_id);

ALTER TABLE public.project_gallery_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "project_gallery_images_owner_all" ON project_gallery_images
  FOR ALL USING (
    highlight_id IN (SELECT id FROM highlights WHERE is_profile_owner(profile_id))
  );

CREATE POLICY "project_gallery_images_public_read" ON project_gallery_images
  FOR SELECT USING (
    highlight_id IN (SELECT id FROM highlights WHERE status = 'active')
  );
