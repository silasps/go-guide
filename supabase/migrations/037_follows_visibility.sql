-- Fecha a lacuna de RLS de `follows` (migration 033): até aqui só era
-- possível ler os follows que o próprio usuário fez, nunca quem segue o
-- seu perfil. Reaproveita is_profile_owner() (mesmo padrão anti-recursão
-- de partners_owner_all, payment_methods etc.).
CREATE POLICY "follows_owner_read" ON follows
  FOR SELECT USING (is_profile_owner(profile_id));

-- Espelha follower_count (033), que existe mas não era usado em lugar
-- nenhum do app até esta migration.
CREATE OR REPLACE FUNCTION following_count(p_profile_id uuid)
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT count(*) FROM follows
  WHERE follower_user_id = (SELECT user_id FROM profiles WHERE id = p_profile_id);
$$;

-- Listas paginadas com dados de exibição, para a aba Seguidores/Seguindo
-- do perfil público. SECURITY DEFINER ignora a RLS de `follows`/`profiles`,
-- então a checagem de visibilidade (perfil público ou o próprio dono
-- olhando) fica dentro da função — não pode ficar só na RLS.
CREATE OR REPLACE FUNCTION get_followers(p_profile_id uuid, p_limit int DEFAULT 30, p_offset int DEFAULT 0)
RETURNS TABLE (
  profile_id uuid,
  username text,
  display_name text,
  avatar_url text,
  accent_color text,
  user_role text,
  followed_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT p.id, p.username, p.display_name, p.avatar_url, p.accent_color, p.user_role, f.created_at
  FROM follows f
  JOIN profiles p ON p.user_id = f.follower_user_id
  WHERE f.profile_id = p_profile_id
    AND EXISTS (
      SELECT 1 FROM profiles owner
      WHERE owner.id = p_profile_id
        AND (owner.privacy_mode = 'public' OR is_profile_owner(owner.id))
    )
  ORDER BY f.created_at DESC
  LIMIT p_limit OFFSET p_offset;
$$;

CREATE OR REPLACE FUNCTION get_following(p_profile_id uuid, p_limit int DEFAULT 30, p_offset int DEFAULT 0)
RETURNS TABLE (
  profile_id uuid,
  username text,
  display_name text,
  avatar_url text,
  accent_color text,
  user_role text,
  followed_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT p.id, p.username, p.display_name, p.avatar_url, p.accent_color, p.user_role, f.created_at
  FROM follows f
  JOIN profiles p ON p.id = f.profile_id
  WHERE f.follower_user_id = (SELECT user_id FROM profiles WHERE id = p_profile_id)
    AND EXISTS (
      SELECT 1 FROM profiles owner
      WHERE owner.id = p_profile_id
        AND (owner.privacy_mode = 'public' OR is_profile_owner(owner.id))
    )
  ORDER BY f.created_at DESC
  LIMIT p_limit OFFSET p_offset;
$$;
