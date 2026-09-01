-- ============================================================
-- Links curtos para perfil e projetos — pedido do usuário: o link de
-- projeto (/[username]/projetos/[slug]) fica longo demais pra bio do
-- Instagram. Resolve o alvo por FK (profile_id/highlight_id) em vez de
-- gravar o path final, então sobrevive a troca de username/slug sem
-- precisar duplicar o histórico da migration 058 (url_stability).
--
-- Leitura fica fechada pro dono (RLS normal) — a resolução pública do
-- código, usada pelo redirect /l/[code] com visitante anônimo, passa só
-- pela function SECURITY DEFINER abaixo, que devolve exclusivamente
-- target_type/profile_id/highlight_id (nunca click_count nem o resto da
-- tabela) pro código pedido, evitando que alguém com a anon key liste
-- todos os links/cliques da plataforma via REST.
-- ============================================================

CREATE TABLE public.short_links (
  id            UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  profile_id    UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  code          TEXT NOT NULL UNIQUE,
  target_type   TEXT NOT NULL CHECK (target_type IN ('profile', 'project')),
  highlight_id  UUID REFERENCES highlights(id) ON DELETE CASCADE,
  click_count   INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (
    (target_type = 'profile' AND highlight_id IS NULL)
    OR (target_type = 'project' AND highlight_id IS NOT NULL)
  )
);

CREATE INDEX idx_short_links_profile_id ON short_links (profile_id);

-- Um link por alvo: reaproveita o existente em vez de acumular um código
-- novo a cada clique em "copiar link curto".
CREATE UNIQUE INDEX idx_short_links_one_per_profile ON short_links (profile_id) WHERE target_type = 'profile';
CREATE UNIQUE INDEX idx_short_links_one_per_project ON short_links (highlight_id) WHERE target_type = 'project';

-- Garante que highlight_id (quando presente) realmente pertence a
-- profile_id — RLS só cobre "profile_id é meu", não a consistência entre
-- as duas colunas, e um CHECK simples não alcança outra tabela.
CREATE OR REPLACE FUNCTION check_short_link_highlight_owner()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.target_type = 'project' AND NOT EXISTS (
    SELECT 1 FROM highlights WHERE id = NEW.highlight_id AND profile_id = NEW.profile_id
  ) THEN
    RAISE EXCEPTION 'highlight_id must belong to profile_id';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_check_short_link_highlight_owner
  BEFORE INSERT OR UPDATE ON short_links
  FOR EACH ROW
  EXECUTE FUNCTION check_short_link_highlight_owner();

ALTER TABLE public.short_links ENABLE ROW LEVEL SECURITY;

-- Dono (ou gestor, via is_profile_owner — migration 023) gerencia os
-- próprios links; ninguém mais lê a tabela direto.
CREATE POLICY "short_links_owner_all" ON short_links
  FOR ALL USING (is_profile_owner(profile_id))
  WITH CHECK (is_profile_owner(profile_id));

-- Resolve um código pro redirect público e já incrementa o clique num
-- único statement atômico (UPDATE ... RETURNING). SECURITY DEFINER pra
-- funcionar com visitante anônimo sem abrir UPDATE/SELECT geral na
-- tabela pra ninguém.
CREATE OR REPLACE FUNCTION resolve_short_link(p_code TEXT)
RETURNS TABLE(target_type TEXT, profile_id UUID, highlight_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
    UPDATE short_links
    SET click_count = click_count + 1
    WHERE code = p_code
    RETURNING short_links.target_type, short_links.profile_id, short_links.highlight_id;
END;
$$;
