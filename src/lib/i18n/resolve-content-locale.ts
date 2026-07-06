import type { ContentTranslation, Locale } from '@/types/database'

export function resolveLocalizedText(
  original: string | null,
  originalLocale: Locale,
  translations: Partial<Record<Locale, ContentTranslation>> | null | undefined,
  visitorLocale: Locale
): { text: string | null; isTranslated: boolean } {
  if (visitorLocale === originalLocale) return { text: original, isTranslated: false }

  const translated = translations?.[visitorLocale]?.content
  if (translated) return { text: translated, isTranslated: true }

  return { text: original, isTranslated: false }
}
