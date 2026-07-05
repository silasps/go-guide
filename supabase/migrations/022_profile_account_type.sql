ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS account_type TEXT NOT NULL DEFAULT 'individual'
  CHECK (account_type IN ('individual', 'family', 'organization'));
