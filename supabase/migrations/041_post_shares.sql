-- ============================================================
-- Contagem de compartilhamentos do post — ação de "disparar", não um
-- toggle como curtir (compartilhar 3x conta 3x). profile_id fica nulo
-- pra visitante anônimo (perfil público pode ser visto sem login).
-- ============================================================
CREATE TABLE public.post_shares (
  id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  post_id     UUID REFERENCES posts(id) ON DELETE CASCADE NOT NULL,
  profile_id  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_post_shares_post_id ON post_shares (post_id);

ALTER TABLE public.post_shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "post_shares_read" ON post_shares
  FOR SELECT USING (can_view_post(post_id));

-- Qualquer um que consiga ver o post pode registrar um compartilhamento,
-- inclusive visitante anônimo (mesmo espírito de pledges_insert_public).
CREATE POLICY "post_shares_insert" ON post_shares
  FOR INSERT WITH CHECK (can_view_post(post_id));
