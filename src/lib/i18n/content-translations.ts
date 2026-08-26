import type { Locale } from '@/i18n/config'
import type { ContentTranslation } from '@/types/database'

export type TranslationSource = 'ai' | 'human'

/** Extrai só o texto de um `*_translations` vindo do banco, pro estado
 *  editável (`Partial<Record<Locale, string>>`) usado pelo `LocaleContentTabs`. */
export function initialTranslations(translations: Partial<Record<Locale, ContentTranslation>> | undefined) {
  const t: Partial<Record<Locale, string>> = {}
  for (const [locale, v] of Object.entries(translations ?? {})) t[locale as Locale] = v.content
  return t
}

export function initialSources(translations: Partial<Record<Locale, ContentTranslation>> | undefined) {
  const s: Partial<Record<Locale, TranslationSource>> = {}
  for (const [locale, v] of Object.entries(translations ?? {})) s[locale as Locale] = v.source
  return s
}

/** Monta o `*_translations` a salvar no banco a partir do estado editável —
 *  omite o idioma original (ele já está no campo principal) e traduções vazias. */
export function buildTranslationsPayload(
  originalLocale: Locale,
  translations: Partial<Record<Locale, string>>,
  sources: Partial<Record<Locale, TranslationSource>>
): Partial<Record<Locale, ContentTranslation>> {
  return Object.fromEntries(
    Object.entries(translations)
      .filter(([locale, text]) => locale !== originalLocale && text?.trim())
      .map(([locale, text]) => [locale, { content: text!.trim(), source: sources[locale as Locale] ?? 'human', translated_at: new Date().toISOString() }])
  )
}

export async function translateContent(profileId: string, sourceLocale: Locale, targetLocale: Locale, text: string): Promise<string | null> {
  if (!text.trim()) return null
  const res = await fetch('/api/ai/translate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ profileId, sourceLocale, targetLocales: [targetLocale], text }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? 'translate_error')
  return data.translations?.[targetLocale] ?? null
}
