create extension if not exists pgcrypto;

create table if not exists public.finance_categories (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint finance_categories_name_not_blank check (length(trim(name)) > 0),
  constraint finance_categories_profile_name_unique unique (profile_id, name)
);

create table if not exists public.finance_accounts (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  kind text not null default 'bank',
  currency text not null default 'BRL',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint finance_accounts_name_not_blank check (length(trim(name)) > 0),
  constraint finance_accounts_kind_check check (kind in ('bank', 'cash', 'credit_card')),
  constraint finance_accounts_currency_check check (currency in ('BRL', 'USD', 'EUR')),
  constraint finance_accounts_profile_name_unique unique (profile_id, name)
);

create table if not exists public.finance_transactions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  category_id uuid references public.finance_categories(id) on delete set null,
  account_id uuid references public.finance_accounts(id) on delete set null,
  date date not null default current_date,
  due_date date,
  description text not null,
  location text,
  notes text,
  amount numeric(12, 2),
  currency text not null default 'BRL',
  type text not null default 'expense',
  mode text not null default 'normal',
  tithe_eligible boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint finance_transactions_description_not_blank check (length(trim(description)) > 0),
  constraint finance_transactions_currency_check check (currency in ('BRL', 'USD', 'EUR')),
  constraint finance_transactions_type_check check (type in ('income', 'expense')),
  constraint finance_transactions_mode_check check (mode in ('normal', 'initial_balance', 'credit_purchase', 'fixed_expense'))
);

alter table public.finance_accounts
  add column if not exists currency text not null default 'BRL';

alter table public.finance_transactions
  add column if not exists account_id uuid references public.finance_accounts(id) on delete set null;

alter table public.finance_transactions
  add column if not exists due_date date;

alter table public.finance_transactions
  add column if not exists location text;

alter table public.finance_transactions
  add column if not exists notes text;

alter table public.finance_transactions
  add column if not exists currency text not null default 'BRL';

alter table public.finance_transactions
  add column if not exists type text not null default 'expense';

alter table public.finance_transactions
  add column if not exists mode text not null default 'normal';

alter table public.finance_transactions
  add column if not exists tithe_eligible boolean not null default false;

alter table public.finance_accounts
  add column if not exists credit_limit numeric(12, 2);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'finance_transactions_type_check'
  ) then
    alter table public.finance_transactions
      add constraint finance_transactions_type_check check (type in ('income', 'expense'));
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'finance_transactions_mode_check'
  ) then
    alter table public.finance_transactions
      add constraint finance_transactions_mode_check check (mode in ('normal', 'initial_balance', 'credit_purchase', 'fixed_expense'));
  end if;
end;
$$;

create index if not exists finance_accounts_profile_id_idx
  on public.finance_accounts(profile_id);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'finance_transactions_currency_check'
  ) then
    alter table public.finance_transactions
      add constraint finance_transactions_currency_check check (currency in ('BRL', 'USD', 'EUR'));
  end if;
end;
$$;

create index if not exists finance_categories_profile_id_idx
  on public.finance_categories(profile_id);

create index if not exists finance_transactions_profile_date_idx
  on public.finance_transactions(profile_id, date desc);

create index if not exists finance_transactions_category_id_idx
  on public.finance_transactions(category_id);

create index if not exists finance_transactions_account_id_idx
  on public.finance_transactions(account_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_finance_categories_updated_at on public.finance_categories;
create trigger set_finance_categories_updated_at
before update on public.finance_categories
for each row execute function public.set_updated_at();

drop trigger if exists set_finance_transactions_updated_at on public.finance_transactions;
create trigger set_finance_transactions_updated_at
before update on public.finance_transactions
for each row execute function public.set_updated_at();

drop trigger if exists set_finance_accounts_updated_at on public.finance_accounts;
create trigger set_finance_accounts_updated_at
before update on public.finance_accounts
for each row execute function public.set_updated_at();

alter table public.finance_categories enable row level security;
alter table public.finance_accounts enable row level security;
alter table public.finance_transactions enable row level security;

drop policy if exists "finance categories are managed by owner" on public.finance_categories;
create policy "finance categories are managed by owner"
on public.finance_categories
for all
to authenticated
using (profile_id = auth.uid())
with check (profile_id = auth.uid());

drop policy if exists "finance accounts are managed by owner" on public.finance_accounts;
create policy "finance accounts are managed by owner"
on public.finance_accounts
for all
to authenticated
using (profile_id = auth.uid())
with check (profile_id = auth.uid());

drop policy if exists "finance transactions are managed by owner" on public.finance_transactions;
create policy "finance transactions are managed by owner"
on public.finance_transactions
for all
to authenticated
using (profile_id = auth.uid())
with check (profile_id = auth.uid());
