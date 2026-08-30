-- ============================================================
-- Telefone/WhatsApp opcional da CONTA (profiles), não do vínculo de
-- parceria (que já tem partners.phone). Serve pra: (1) o parceiro
-- informar uma vez só e reaproveitar em qualquer vínculo novo, (2) dar ao
-- missionário o contato + autorização explícita pra falar com essa pessoa
-- por WhatsApp — não envolve envio automático de mensagem, só guarda o
-- dado e o consentimento.
-- ============================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_contact_opt_in BOOLEAN NOT NULL DEFAULT false;

-- handle_new_user() já lia full_name de raw_user_meta_data — passa a ler
-- phone também, pra funcionar mesmo quando a confirmação de e-mail está
-- ativa e o usuário ainda não tem sessão (não dá pra fazer update via
-- client nesse momento, então precisa entrar já na criação do registro).
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, username, display_name, phone)
  VALUES (
    NEW.id,
    LOWER(SPLIT_PART(NEW.email, '@', 1)) || '_' || SUBSTR(NEW.id::TEXT, 1, 6),
    COALESCE(NEW.raw_user_meta_data->>'full_name', SPLIT_PART(NEW.email, '@', 1)),
    NULLIF(NEW.raw_user_meta_data->>'phone', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
