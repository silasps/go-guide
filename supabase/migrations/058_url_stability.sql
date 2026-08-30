-- ============================================================
-- Estabilidade de link: quando profiles.username ou highlights.slug
-- mudam, o link antigo compartilhado (WhatsApp, redes, etc.) passa a
-- redirecionar pro atual em vez de dar 404. Escrita via trigger (não
-- código de aplicação) pra cobrir qualquer caminho de update, presente
-- ou futuro, sem depender de cada form lembrar de gravar o histórico.
-- ============================================================

CREATE TABLE public.profile_username_history (
  id            UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  profile_id    UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  old_username  TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Unique por lower() pra impedir dois profiles reivindicando o "mesmo"
-- username antigo em capitalizações diferentes — mesma regra de
-- idx_profiles_username.
CREATE UNIQUE INDEX idx_profile_username_history_username ON profile_username_history (lower(old_username));

ALTER TABLE public.profile_username_history ENABLE ROW LEVEL SECURITY;
-- Leitura pública (mapeamento não é dado sensível, é só "slug antigo -> id
-- atual") — necessário pro fallback de redirect funcionar com o client
-- anônimo, igual a leitura de posts/highlights públicos. Escrita só via
-- trigger SECURITY DEFINER abaixo, nunca direto pelo client.
CREATE POLICY "profile_username_history_read" ON profile_username_history
  FOR SELECT USING (true);

CREATE OR REPLACE FUNCTION track_username_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF OLD.username IS DISTINCT FROM NEW.username THEN
    INSERT INTO profile_username_history (profile_id, old_username)
    VALUES (OLD.id, OLD.username)
    ON CONFLICT (lower(old_username))
    DO UPDATE SET profile_id = EXCLUDED.profile_id, created_at = NOW();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_track_username_change
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION track_username_change();

-- ============================================================
-- Mesma ideia pro slug de projeto (highlights).
-- ============================================================

CREATE TABLE public.highlight_slug_history (
  id            UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  highlight_id  UUID REFERENCES highlights(id) ON DELETE CASCADE NOT NULL,
  profile_id    UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  old_slug      TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (profile_id, old_slug)
);

ALTER TABLE public.highlight_slug_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "highlight_slug_history_read" ON highlight_slug_history
  FOR SELECT USING (true);

CREATE OR REPLACE FUNCTION track_highlight_slug_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF OLD.slug IS DISTINCT FROM NEW.slug AND OLD.slug IS NOT NULL THEN
    INSERT INTO highlight_slug_history (highlight_id, profile_id, old_slug)
    VALUES (OLD.id, OLD.profile_id, OLD.slug)
    ON CONFLICT (profile_id, old_slug)
    DO UPDATE SET highlight_id = EXCLUDED.highlight_id, created_at = NOW();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_track_highlight_slug_change
  BEFORE UPDATE ON highlights
  FOR EACH ROW
  EXECUTE FUNCTION track_highlight_slug_change();
