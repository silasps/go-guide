-- Busca "difusa" (tolerante a acento e a erro de digitação) pro diretório
-- público (missionários + projetos). Antes disso, searchDirectory() usava
-- ILIKE puro, que falha em "familia" vs "Família" (acento é um caractere
-- diferente pro Postgres) e não tem noção de relevância — resultados vinham
-- em ordem arbitrária, sem nada parecido aparecendo quando não há match
-- exato.

CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- unaccent() de fábrica é STABLE (não IMMUTABLE), então não pode ser usada
-- direto num índice funcional. Wrapper IMMUTABLE é o workaround padrão do
-- Postgres pra isso (o dicionário 'unaccent' não muda em runtime).
CREATE OR REPLACE FUNCTION public.immutable_unaccent(text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
STRICT
AS $$
  SELECT public.unaccent('public.unaccent'::regdictionary, $1)
$$;

CREATE INDEX IF NOT EXISTS idx_profiles_display_name_trgm
  ON public.profiles USING gin (public.immutable_unaccent(lower(display_name)) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_profiles_username_trgm
  ON public.profiles USING gin (lower(username) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_profiles_bio_trgm
  ON public.profiles USING gin (public.immutable_unaccent(lower(coalesce(bio, ''))) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_highlights_title_trgm
  ON public.highlights USING gin (public.immutable_unaccent(lower(title)) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_highlights_description_trgm
  ON public.highlights USING gin (public.immutable_unaccent(lower(coalesce(description, ''))) gin_trgm_ops);

-- Missionários: ranqueia por similaridade de trigrama (maior peso pro nome,
-- depois username, depois bio) e inclui tanto match direto (substring, já
-- sem acento) quanto resultados "parecidos" acima de um piso de similaridade
-- — assim "familia oliveira" aparece depois de "Família Silva" numa busca
-- por "familia silva", em vez de sumir. SECURITY INVOKER (padrão): roda com
-- o papel de quem chamou, respeitando a RLS de profiles normalmente.
CREATE OR REPLACE FUNCTION public.search_missionaries(
  q text,
  viewer_user_id uuid DEFAULT NULL,
  result_limit int DEFAULT 12
)
RETURNS TABLE (
  id uuid,
  username text,
  display_name text,
  avatar_url text,
  accent_color text,
  bio text,
  location text,
  show_location boolean
)
LANGUAGE sql
STABLE
AS $$
  WITH scored AS (
    SELECT
      p.id, p.username, p.display_name, p.avatar_url, p.accent_color, p.bio, p.location, p.show_location,
      similarity(public.immutable_unaccent(lower(p.display_name)), public.immutable_unaccent(lower(q))) AS name_sim,
      similarity(lower(p.username), lower(q)) AS username_sim,
      similarity(public.immutable_unaccent(lower(coalesce(p.bio, ''))), public.immutable_unaccent(lower(q))) AS bio_sim,
      (public.immutable_unaccent(lower(p.display_name)) LIKE '%' || public.immutable_unaccent(lower(q)) || '%'
        OR lower(p.username) LIKE '%' || lower(q) || '%'
        OR public.immutable_unaccent(lower(coalesce(p.bio, ''))) LIKE '%' || public.immutable_unaccent(lower(q)) || '%'
      ) AS is_direct_match
    FROM public.profiles p
    WHERE p.privacy_mode = 'public'
      AND p.user_role = 'missionary'
      AND p.verification_status = 'approved'
      AND p.account_status = 'active'
      AND (viewer_user_id IS NULL OR p.user_id <> viewer_user_id)
  )
  SELECT id, username, display_name, avatar_url, accent_color, bio, location, show_location
  FROM scored
  WHERE is_direct_match OR GREATEST(name_sim, username_sim * 0.8, bio_sim * 0.5) > 0.15
  ORDER BY is_direct_match DESC, GREATEST(name_sim, username_sim * 0.8, bio_sim * 0.5) DESC, display_name ASC
  LIMIT result_limit
$$;

-- Projetos (highlights): mesma lógica, ranqueado por título (peso maior) e
-- descrição. Já traz os campos do perfil dono pra evitar N+1 na action.
CREATE OR REPLACE FUNCTION public.search_highlights(
  q text,
  result_limit int DEFAULT 24
)
RETURNS TABLE (
  id uuid,
  slug text,
  title text,
  cover_url text,
  cover_position text,
  profile_username text,
  profile_display_name text,
  profile_accent_color text
)
LANGUAGE sql
STABLE
AS $$
  WITH scored AS (
    SELECT
      h.id, h.slug, h.title, h.cover_url, h.cover_position,
      p.username AS profile_username, p.display_name AS profile_display_name, p.accent_color AS profile_accent_color,
      similarity(public.immutable_unaccent(lower(h.title)), public.immutable_unaccent(lower(q))) AS title_sim,
      similarity(public.immutable_unaccent(lower(coalesce(h.description, ''))), public.immutable_unaccent(lower(q))) AS desc_sim,
      (public.immutable_unaccent(lower(h.title)) LIKE '%' || public.immutable_unaccent(lower(q)) || '%'
        OR public.immutable_unaccent(lower(coalesce(h.description, ''))) LIKE '%' || public.immutable_unaccent(lower(q)) || '%'
      ) AS is_direct_match
    FROM public.highlights h
    JOIN public.profiles p ON p.id = h.profile_id
    WHERE h.status <> 'hidden'
      AND p.privacy_mode = 'public'
      AND p.user_role = 'missionary'
      AND p.verification_status = 'approved'
      AND p.account_status = 'active'
  )
  SELECT id, slug, title, cover_url, cover_position, profile_username, profile_display_name, profile_accent_color
  FROM scored
  WHERE is_direct_match OR GREATEST(title_sim, desc_sim * 0.5) > 0.15
  ORDER BY is_direct_match DESC, GREATEST(title_sim, desc_sim * 0.5) DESC, title ASC
  LIMIT result_limit
$$;
