-- "Seguir" leve, um clique, deliberadamente separado do compromisso formal
-- de parceria em `partners`.
CREATE TABLE follows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  follower_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (follower_user_id, profile_id)
);

CREATE INDEX idx_follows_follower ON follows(follower_user_id);
CREATE INDEX idx_follows_profile ON follows(profile_id);

ALTER TABLE follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "follows_insert_self" ON follows
  FOR INSERT WITH CHECK (auth.uid() = follower_user_id);

CREATE POLICY "follows_self_read" ON follows
  FOR SELECT USING (auth.uid() = follower_user_id);

CREATE POLICY "follows_self_delete" ON follows
  FOR DELETE USING (auth.uid() = follower_user_id);

-- Contagem de seguidores sem expor identidade — mesmo padrão anti-recursão
-- de is_profile_owner() (SECURITY DEFINER STABLE).
CREATE OR REPLACE FUNCTION follower_count(p_profile_id uuid)
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT count(*) FROM follows WHERE profile_id = p_profile_id;
$$;

-- Exhaust de eventos para o futuro algoritmo (Fase 2+ ML/embeddings).
-- Write-only nesta fase: sem policy de SELECT para usuário comum.
CREATE TABLE feed_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'post_view', 'post_click', 'project_view', 'project_click',
    'follow', 'unfollow', 'pledge_from_feed'
  )),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  project_id UUID REFERENCES highlights(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_feed_events_actor ON feed_events(actor_user_id, created_at DESC);
CREATE INDEX idx_feed_events_profile ON feed_events(profile_id, created_at DESC);

ALTER TABLE feed_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "feed_events_insert_self" ON feed_events
  FOR INSERT WITH CHECK (auth.uid() = actor_user_id);
