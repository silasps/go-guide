-- Idioma padrão do app passou de pt para en (src/i18n/config.ts,
-- DEFAULT_LOCALE) — quando nada mais resolve o locale (sem preferência
-- salva, sem cookie, sem Accept-Language reconhecível, sem país mapeado em
-- src/i18n/request.ts), cai em inglês. Acompanha esse mesmo default aqui:
-- o registro de profiles nasce em 'en' quando nada mais é informado.
ALTER TABLE public.profiles ALTER COLUMN locale SET DEFAULT 'en';

-- handle_new_user() já lia full_name/phone/birth_date de raw_user_meta_data
-- (migrations 055/080) — passa a ler locale também, pro cadastro
-- (src/app/(auth)/cadastro/page.tsx) gravar o idioma que o next-intl já
-- detectou pra aquele visitante (cookie/navegador/geo-IP), em vez da conta
-- nascer sempre em 'en'/'pt' independente de como a pessoa chegou. Validado
-- contra o mesmo conjunto do CHECK constraint (migration 024) pra nunca
-- quebrar o INSERT com um valor inesperado vindo de raw_user_meta_data.
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, username, display_name, phone, birth_date, locale)
  VALUES (
    NEW.id,
    LOWER(SPLIT_PART(NEW.email, '@', 1)) || '_' || SUBSTR(NEW.id::TEXT, 1, 6),
    COALESCE(NEW.raw_user_meta_data->>'full_name', SPLIT_PART(NEW.email, '@', 1)),
    NULLIF(NEW.raw_user_meta_data->>'phone', ''),
    NULLIF(NEW.raw_user_meta_data->>'birth_date', '')::DATE,
    CASE WHEN NEW.raw_user_meta_data->>'locale' IN ('pt', 'en', 'es')
      THEN NEW.raw_user_meta_data->>'locale'
      ELSE 'en'
    END
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
