-- ============================================================
-- Data de nascimento da CONTA (profiles), coletada no cadastro (manual ou
-- via Google) — não a de partners.birth_date (que é o vínculo de parceria
-- de um missionário específico, preenchido manualmente ou copiado daqui
-- quando a pessoa vira parceira fixa). Serve pra: (1) a plataforma
-- parabenizar o próprio usuário, (2) alimentar automaticamente
-- partners.birth_date quando uma conta com aniversário já preenchido se
-- torna parceira, pra que BirthdayReminders funcione sem exigir que o
-- missionário cadastre a data manualmente de novo.
-- ============================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS birth_date DATE;

-- handle_new_user() já lia full_name e phone de raw_user_meta_data — passa a
-- ler birth_date também, pelo mesmo motivo do 055 (confirmação de e-mail
-- ativa pode deixar a criação do registro sem sessão de cliente disponível
-- pra um update logo em seguida).
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, username, display_name, phone, birth_date)
  VALUES (
    NEW.id,
    LOWER(SPLIT_PART(NEW.email, '@', 1)) || '_' || SUBSTR(NEW.id::TEXT, 1, 6),
    COALESCE(NEW.raw_user_meta_data->>'full_name', SPLIT_PART(NEW.email, '@', 1)),
    NULLIF(NEW.raw_user_meta_data->>'phone', ''),
    NULLIF(NEW.raw_user_meta_data->>'birth_date', '')::DATE
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
