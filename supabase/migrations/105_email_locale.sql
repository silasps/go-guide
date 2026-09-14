-- ============================================================
-- Idioma de e-mails transacionais pra quem não tem conta (e por
-- isso não tem `profiles.locale`): convidado em oferta avulsa
-- (`pledges`), oferta agendada (`scheduled_pledges`), parceria
-- recorrente manual (`recurring_pledges`) e parceiro cadastrado sem
-- login (`partners`, fluxo de oração/embaixador/voluntariado).
-- Capturado no cliente a partir do locale ativo (next-intl) no
-- momento do cadastro — sem isso, todo lembrete/confirmação pra
-- quem nunca criou conta saía sempre em PT, ignorando o idioma que
-- a própria pessoa já estava navegando. Pra quem tem conta
-- (`reporter_user_id`/`partners.user_id` preenchido), a fonte da
-- verdade continua sendo `profiles.locale` — essas colunas ficam
-- NULL nesse caso e são ignoradas na resolução do idioma do e-mail.
-- ============================================================
ALTER TABLE public.pledges           ADD COLUMN reporter_locale TEXT CHECK (reporter_locale IN ('pt', 'en', 'es'));
ALTER TABLE public.scheduled_pledges ADD COLUMN reporter_locale TEXT CHECK (reporter_locale IN ('pt', 'en', 'es'));
ALTER TABLE public.recurring_pledges ADD COLUMN reporter_locale TEXT CHECK (reporter_locale IN ('pt', 'en', 'es'));
ALTER TABLE public.partners          ADD COLUMN locale           TEXT CHECK (locale IN ('pt', 'en', 'es'));
