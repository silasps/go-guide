-- ============================================================
-- MODERAÇÃO: verificação de missionário (aprovação manual), denúncias
-- de post/comentário/perfil, ocultação automática por denúncia (item e
-- conta) e fila de revisão do superadmin.
-- ============================================================

ALTER TABLE profiles
  ADD COLUMN verification_status TEXT NOT NULL DEFAULT 'approved'
    CHECK (verification_status IN ('pending', 'approved', 'rejected')),
  ADD COLUMN account_status TEXT NOT NULL DEFAULT 'active'
    CHECK (account_status IN ('active', 'hidden_pending_review', 'suspended'));
-- DEFAULT acima já backfilla toda conta existente como 'approved'/'active'
-- (grandfathering automático) — só quem virar missionário a partir de
-- agora entra pendente (ver becomeMissionary() em dashboard/actions.ts).

ALTER TABLE posts
  ADD COLUMN moderation_status TEXT NOT NULL DEFAULT 'visible'
    CHECK (moderation_status IN ('visible', 'hidden_pending_review', 'removed'));

ALTER TABLE post_comments
  ADD COLUMN moderation_status TEXT NOT NULL DEFAULT 'visible'
    CHECK (moderation_status IN ('visible', 'hidden_pending_review', 'removed'));

-- ============================================================
-- REPORTS — denúncias de posts, comentários e perfis.
-- ============================================================
CREATE TABLE public.reports (
  id                  UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  reporter_user_id    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  target_type         TEXT NOT NULL CHECK (target_type IN ('post', 'comment', 'profile')),
  target_id           UUID NOT NULL,
  -- Denormalizado no insert: pra post/comment é o profile_id do dono do
  -- conteúdo, pra profile é o próprio target_id. Existe pra permitir
  -- contar "quantas pessoas diferentes já denunciaram este autor, por
  -- qualquer motivo" sem precisar de join caro (post ou comment) por
  -- linha na hora de decidir se a CONTA escala pra hidden_pending_review.
  target_profile_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reason              TEXT NOT NULL CHECK (reason IN ('nudity', 'hate_speech', 'spam', 'harassment', 'impersonation', 'other')),
  details             TEXT,
  status              TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'dismissed', 'actioned')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (reporter_user_id, target_type, target_id)
);

CREATE INDEX idx_reports_target ON reports (target_type, target_id, status);
CREATE INDEX idx_reports_target_profile ON reports (target_profile_id, status);

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reports_insert_self" ON reports
  FOR INSERT WITH CHECK (auth.uid() = reporter_user_id);

-- Sem policy de SELECT/UPDATE pra usuário comum — só service-role (que
-- ignora RLS) lê e atualiza status, mesmo padrão write-only de
-- feed_events (migration 042-ish). A fila de revisão do superadmin
-- (/superadmin/moderacao) sempre lê via service-role.

-- ============================================================
-- can_view_post() — agora também respeita moderation_status do post e
-- account_status do autor. Dono do perfil sempre enxerga o próprio post
-- (via is_profile_owner), qualquer outro visitante só quando o item E a
-- conta do autor estão visíveis/ativos.
-- ============================================================
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
        is_profile_owner(posts.profile_id)
        OR (
          posts.moderation_status = 'visible'
          AND profiles.account_status = 'active'
          AND (
            profiles.privacy_mode = 'public'
            OR is_profile_viewer_or_above(posts.profile_id)
            OR EXISTS (
              SELECT 1 FROM partners
              WHERE partners.profile_id = posts.profile_id AND partners.user_id = auth.uid()
            )
          )
        )
      )
  );
$$;

-- posts_public_read (migration 023) — mesma lógica: dono sempre vê a
-- própria linha via posts_owner_all (policy separada, não tocada aqui);
-- gestor/visualizador de conta (is_profile_viewer_or_above) também segue
-- vendo tudo, sem gate de moderação (acesso interno de equipe). Só o
-- branch "público" (privacy_mode público, parceiro, criador avulso) passa
-- a exigir moderation_status/account_status em dia.
DROP POLICY IF EXISTS "posts_public_read" ON posts;
CREATE POLICY "posts_public_read" ON posts
  FOR SELECT USING (
    (published_at IS NOT NULL AND is_draft = false AND moderation_status = 'visible' AND (
      EXISTS (SELECT 1 FROM profiles WHERE profiles.id = posts.profile_id AND profiles.privacy_mode = 'public' AND profiles.account_status = 'active')
      OR auth.uid() = created_by_user_id
      OR EXISTS (SELECT 1 FROM partners WHERE partners.profile_id = posts.profile_id AND partners.user_id = auth.uid())
    ))
    OR is_profile_viewer_or_above(profile_id)
  );

-- post_comments_read (migration 038) — autor do comentário e dono do
-- post sempre veem o próprio comentário oculto; terceiros só quando
-- moderation_status = 'visible' (e can_view_post já cobre item/conta do
-- post em si).
DROP POLICY IF EXISTS "post_comments_read" ON post_comments;
CREATE POLICY "post_comments_read" ON post_comments
  FOR SELECT USING (
    deleted_at IS NULL
    AND can_view_post(post_id)
    AND (
      moderation_status = 'visible'
      OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = post_comments.profile_id AND profiles.user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM posts WHERE posts.id = post_comments.post_id AND is_profile_owner(posts.profile_id))
    )
  );
