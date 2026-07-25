-- ============================================================
-- POST ENGAGEMENT: proporção de mídia, marcação de pessoas,
-- curtidas e comentários (redesenho do composer inspirado no
-- fluxo de criação do Instagram, mas com dados reais no banco).
-- ============================================================

ALTER TABLE posts
  ADD COLUMN media_aspect_ratio TEXT NOT NULL DEFAULT '4:5'
    CHECK (media_aspect_ratio IN ('original', '1:1', '4:5', '16:9')),
  ADD COLUMN location TEXT;

-- Helper único de visibilidade, reaproveitado pelas 3 tabelas novas
-- abaixo — espelha a condição de posts_public_read (migration 002)
-- mas usando os helpers centralizados de acesso (migration 023),
-- que já cobrem gestores/visualizadores de conta compartilhada.
CREATE OR REPLACE FUNCTION can_view_post(p_post_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM posts
    JOIN profiles ON profiles.id = posts.profile_id
    WHERE posts.id = p_post_id
      AND posts.published_at IS NOT NULL
      AND posts.is_draft = false
      AND (
        profiles.privacy_mode = 'public'
        OR is_profile_viewer_or_above(posts.profile_id)
        OR EXISTS (
          SELECT 1 FROM partners
          WHERE partners.profile_id = posts.profile_id AND partners.user_id = auth.uid()
        )
      )
  );
$$;

-- ============================================================
-- POST_TAGS — marcação de pessoas na imagem (vínculo real a profiles)
-- ============================================================
CREATE TABLE public.post_tags (
  id                  UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  post_id             UUID REFERENCES posts(id) ON DELETE CASCADE NOT NULL,
  media_index         INT NOT NULL CHECK (media_index >= 0),
  tagged_profile_id   UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  position_x          NUMERIC NOT NULL CHECK (position_x BETWEEN 0 AND 100),
  position_y          NUMERIC NOT NULL CHECK (position_y BETWEEN 0 AND 100),
  created_by_user_id  UUID REFERENCES auth.users(id) NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_post_tags_post_id ON post_tags (post_id);
CREATE INDEX idx_post_tags_tagged_profile_id ON post_tags (tagged_profile_id);

ALTER TABLE public.post_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "post_tags_read" ON post_tags
  FOR SELECT USING (can_view_post(post_id));

CREATE POLICY "post_tags_owner_write" ON post_tags
  FOR ALL USING (
    EXISTS (SELECT 1 FROM posts WHERE posts.id = post_tags.post_id AND is_profile_owner(posts.profile_id))
  );

-- ============================================================
-- POST_LIKES
-- ============================================================
CREATE TABLE public.post_likes (
  id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  post_id     UUID REFERENCES posts(id) ON DELETE CASCADE NOT NULL,
  profile_id  UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (post_id, profile_id)
);

CREATE INDEX idx_post_likes_post_id ON post_likes (post_id);

ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "post_likes_read" ON post_likes
  FOR SELECT USING (can_view_post(post_id));

CREATE POLICY "post_likes_own_write" ON post_likes
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = post_likes.profile_id AND profiles.user_id = auth.uid())
  )
  WITH CHECK (
    can_view_post(post_id)
    AND EXISTS (SELECT 1 FROM profiles WHERE profiles.id = post_likes.profile_id AND profiles.user_id = auth.uid())
  );

-- ============================================================
-- POST_COMMENTS
-- ============================================================
CREATE TABLE public.post_comments (
  id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  post_id     UUID REFERENCES posts(id) ON DELETE CASCADE NOT NULL,
  profile_id  UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  content     TEXT NOT NULL CHECK (char_length(btrim(content)) > 0),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at  TIMESTAMPTZ
);

CREATE INDEX idx_post_comments_post_id ON post_comments (post_id);

ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "post_comments_read" ON post_comments
  FOR SELECT USING (deleted_at IS NULL AND can_view_post(post_id));

CREATE POLICY "post_comments_insert" ON post_comments
  FOR INSERT WITH CHECK (
    can_view_post(post_id)
    AND EXISTS (SELECT 1 FROM profiles WHERE profiles.id = post_comments.profile_id AND profiles.user_id = auth.uid())
  );

-- Autor pode editar/apagar (soft delete) o próprio comentário; dono do
-- post pode apagar (moderação) comentários de terceiros no seu post.
CREATE POLICY "post_comments_author_update" ON post_comments
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = post_comments.profile_id AND profiles.user_id = auth.uid())
  );

CREATE POLICY "post_comments_delete" ON post_comments
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = post_comments.profile_id AND profiles.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM posts WHERE posts.id = post_comments.post_id AND is_profile_owner(posts.profile_id))
  );
