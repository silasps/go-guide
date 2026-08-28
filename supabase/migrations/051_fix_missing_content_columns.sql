-- ============================================================
-- O banco remoto está com migrations aplicadas parcialmente (mesmo
-- problema que gerou a 050 pra pledges). Reaplica de forma idempotente
-- as colunas de 047 (que faltavam: erro "Could not find the
-- 'letter_translations' column of 'highlights'") + 048/049 por
-- segurança, já que aqui não há como confirmar o que de fato rodou lá.
-- ============================================================
ALTER TABLE highlights
  ADD COLUMN IF NOT EXISTS scripture_translations JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS letter_translations JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS cover_media_type TEXT NOT NULL DEFAULT 'image'
    CHECK (cover_media_type IN ('image', 'video')),
  ADD COLUMN IF NOT EXISTS cover_status TEXT NOT NULL DEFAULT 'ready'
    CHECK (cover_status IN ('ready', 'processing', 'failed')),
  ADD COLUMN IF NOT EXISTS cover_bunny_video_id TEXT;

ALTER TABLE milestones
  ADD COLUMN IF NOT EXISTS title_translations JSONB NOT NULL DEFAULT '{}';

ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS media_status TEXT NOT NULL DEFAULT 'ready'
    CHECK (media_status IN ('ready', 'processing', 'failed')),
  ADD COLUMN IF NOT EXISTS media_bunny_video_id TEXT;

ALTER TABLE posts DROP CONSTRAINT IF EXISTS posts_media_aspect_ratio_check;
ALTER TABLE posts ADD CONSTRAINT posts_media_aspect_ratio_check
  CHECK (media_aspect_ratio IN ('original', '1:1', '4:5', '1.91:1'));

CREATE INDEX IF NOT EXISTS idx_highlights_cover_bunny_video_id
  ON highlights (cover_bunny_video_id) WHERE cover_bunny_video_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_posts_media_bunny_video_id
  ON posts (media_bunny_video_id) WHERE media_bunny_video_id IS NOT NULL;

NOTIFY pgrst, 'reload schema';
