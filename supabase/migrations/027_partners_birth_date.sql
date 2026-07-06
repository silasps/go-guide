-- ============================================================
-- Data de nascimento do parceiro, para lembretes de aniversário
-- no dashboard do missionário (ver BirthdayReminders).
-- ============================================================
ALTER TABLE public.partners
  ADD COLUMN IF NOT EXISTS birth_date DATE;
