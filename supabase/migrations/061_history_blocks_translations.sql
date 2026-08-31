-- Editor de História não tinha nenhum jeito de traduzir o conteúdo pras
-- outras línguas (PT/EN/ES) — único editor de conteúdo do app nessa
-- situação (posts, bio e projeto já suportam via *_translations JSONB +
-- LocaleContentTabs). `history_blocks.content` já é um JSONB livre por
-- tipo, então as traduções entram dentro dele mesmo (title_translations/
-- text_translations, e por item em `timeline.items[].text_translations`)
-- em vez de novas colunas — só falta saber qual idioma é o original.
ALTER TABLE public.history_blocks
  ADD COLUMN IF NOT EXISTS original_locale TEXT NOT NULL DEFAULT 'pt' CHECK (original_locale IN ('pt', 'en', 'es'));
