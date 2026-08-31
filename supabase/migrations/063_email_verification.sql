-- Verificação de e-mail obrigatória no cadastro (token custom + Brevo, não o
-- fluxo nativo do Supabase — decisão do usuário para reaproveitar o envio de
-- e-mail já existente no app e não depender de configuração no painel).
alter table profiles
  add column if not exists email_verified boolean not null default false,
  add column if not exists email_verification_token text,
  add column if not exists email_verification_token_expires_at timestamptz;

create unique index if not exists idx_profiles_email_verification_token
  on profiles (email_verification_token) where email_verification_token is not null;

-- Grandfathering: a exigência vale pra contas criadas a partir de agora, não
-- retroativamente — sem isso, todo mundo que já tem conta (Google incluso,
-- que o Google já verifica) cairia bloqueado no próximo acesso ao dashboard.
update profiles set email_verified = true where email_verified = false;

-- Contas Google já vêm com e-mail verificado pelo próprio provider; só
-- e-mail/senha nasce pendente de verificação. Redefine de novo a mesma
-- função da migration 055 (telefone) — CREATE OR REPLACE substitui o corpo
-- inteiro, então repete a leitura de `phone` de lá pra não perder esse campo.
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (user_id, username, display_name, phone, email_verified)
  values (
    new.id,
    lower(split_part(new.email, '@', 1)) || '_' || substr(new.id::text, 1, 6),
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    nullif(new.raw_user_meta_data->>'phone', ''),
    coalesce(new.raw_app_meta_data->>'provider', 'email') != 'email'
  );
  return new;
end;
$$ language plpgsql security definer;
