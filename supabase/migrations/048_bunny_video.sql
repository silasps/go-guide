-- Vídeo de post e de capa de projeto passam a ser processados de forma
-- assíncrona pelo Bunny Stream (transcodifica qualquer formato de entrada
-- em HLS compacto). cover_url/media_urls continuam sendo a URL final de
-- reprodução — evita duplicar coluna. Enquanto status = 'processing', o
-- valor antigo (se houver) permanece servido normalmente até o webhook do
-- Bunny confirmar o encoding e trocar a URL.
ALTER TABLE public.highlights
  ADD COLUMN IF NOT EXISTS cover_media_type TEXT NOT NULL DEFAULT 'image'
    CHECK (cover_media_type IN ('image', 'video')),
  ADD COLUMN IF NOT EXISTS cover_status TEXT NOT NULL DEFAULT 'ready'
    CHECK (cover_status IN ('ready', 'processing', 'failed')),
  ADD COLUMN IF NOT EXISTS cover_bunny_video_id TEXT;

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS media_status TEXT NOT NULL DEFAULT 'ready'
    CHECK (media_status IN ('ready', 'processing', 'failed')),
  ADD COLUMN IF NOT EXISTS media_bunny_video_id TEXT;

CREATE INDEX IF NOT EXISTS idx_highlights_cover_bunny_video_id
  ON public.highlights (cover_bunny_video_id) WHERE cover_bunny_video_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_posts_media_bunny_video_id
  ON public.posts (media_bunny_video_id) WHERE media_bunny_video_id IS NOT NULL;
