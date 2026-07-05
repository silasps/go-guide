-- ============================================================
-- Correção de ON DELETE em FKs para auth.users que hoje são
-- NO ACTION (padrão do Postgres quando não especificado).
--
-- Sem isso, excluir uma conta (DELETE FROM auth.users) falha com
-- violação de FK sempre que o usuário aparece como "quem fez X" em
-- uma linha que pertence a OUTRO perfil (ex.: é parceiro de outro
-- missionário, é membro de uma equipe de outro projeto, pediu
-- oração no perfil de outro missionário) — porque essas linhas não
-- são apagadas em cascata pelo próprio perfil do usuário.
--
-- Linhas que pertencem ao próprio perfil do usuário já são resolvidas
-- pela cascata profiles -> (highlights/posts/transactions/etc), então
-- esta migration cobre apenas os casos que faltavam.
-- ============================================================

ALTER TABLE public.partners DROP CONSTRAINT IF EXISTS partners_user_id_fkey;
ALTER TABLE public.partners ADD CONSTRAINT partners_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.account_members DROP CONSTRAINT IF EXISTS account_members_user_id_fkey;
ALTER TABLE public.account_members ADD CONSTRAINT account_members_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.financial_accounts ALTER COLUMN created_by_user_id DROP NOT NULL;
ALTER TABLE public.financial_accounts DROP CONSTRAINT IF EXISTS financial_accounts_created_by_user_id_fkey;
ALTER TABLE public.financial_accounts ADD CONSTRAINT financial_accounts_created_by_user_id_fkey
  FOREIGN KEY (created_by_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.transactions ALTER COLUMN created_by_user_id DROP NOT NULL;
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_created_by_user_id_fkey;
ALTER TABLE public.transactions ADD CONSTRAINT transactions_created_by_user_id_fkey
  FOREIGN KEY (created_by_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.posts ALTER COLUMN created_by_user_id DROP NOT NULL;
ALTER TABLE public.posts DROP CONSTRAINT IF EXISTS posts_created_by_user_id_fkey;
ALTER TABLE public.posts ADD CONSTRAINT posts_created_by_user_id_fkey
  FOREIGN KEY (created_by_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.project_members DROP CONSTRAINT IF EXISTS project_members_invited_by_user_id_fkey;
ALTER TABLE public.project_members ADD CONSTRAINT project_members_invited_by_user_id_fkey
  FOREIGN KEY (invited_by_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.pledges DROP CONSTRAINT IF EXISTS pledges_reviewed_by_user_id_fkey;
ALTER TABLE public.pledges ADD CONSTRAINT pledges_reviewed_by_user_id_fkey
  FOREIGN KEY (reviewed_by_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.prayer_requests ALTER COLUMN requester_id DROP NOT NULL;
ALTER TABLE public.prayer_requests DROP CONSTRAINT IF EXISTS prayer_requests_requester_id_fkey;
ALTER TABLE public.prayer_requests ADD CONSTRAINT prayer_requests_requester_id_fkey
  FOREIGN KEY (requester_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.prayer_request_replies ALTER COLUMN author_user_id DROP NOT NULL;
ALTER TABLE public.prayer_request_replies DROP CONSTRAINT IF EXISTS prayer_request_replies_author_user_id_fkey;
ALTER TABLE public.prayer_request_replies ADD CONSTRAINT prayer_request_replies_author_user_id_fkey
  FOREIGN KEY (author_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
