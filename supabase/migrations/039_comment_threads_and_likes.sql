-- ============================================================
-- Respostas identadas a comentários específicos + curtidas em
-- comentário (às vezes a pessoa só quer reagir, não responder texto).
-- ============================================================

ALTER TABLE post_comments
  ADD COLUMN parent_comment_id UUID REFERENCES post_comments(id) ON DELETE CASCADE;

CREATE INDEX idx_post_comments_parent_id ON post_comments (parent_comment_id) WHERE parent_comment_id IS NOT NULL;

-- ============================================================
-- COMMENT_LIKES
-- ============================================================
CREATE TABLE public.comment_likes (
  id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  comment_id  UUID REFERENCES post_comments(id) ON DELETE CASCADE NOT NULL,
  profile_id  UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (comment_id, profile_id)
);

CREATE INDEX idx_comment_likes_comment_id ON comment_likes (comment_id);

ALTER TABLE public.comment_likes ENABLE ROW LEVEL SECURITY;

-- Mesma visibilidade do post ao qual o comentário pertence (reaproveita
-- can_view_post da migration 038, via join comment -> post).
CREATE POLICY "comment_likes_read" ON comment_likes
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM post_comments WHERE post_comments.id = comment_likes.comment_id AND can_view_post(post_comments.post_id))
  );

CREATE POLICY "comment_likes_own_write" ON comment_likes
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = comment_likes.profile_id AND profiles.user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = comment_likes.profile_id AND profiles.user_id = auth.uid())
    AND EXISTS (SELECT 1 FROM post_comments WHERE post_comments.id = comment_likes.comment_id AND can_view_post(post_comments.post_id))
  );
