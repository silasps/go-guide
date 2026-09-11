export const LOCALES = ['pt', 'en', 'es'] as const
export type Locale = (typeof LOCALES)[number]
export const DEFAULT_LOCALE: Locale = 'en'
export const LOCALE_COOKIE = 'NEXT_LOCALE'

export function isLocale(value: string | undefined | null): value is Locale {
  return !!value && (LOCALES as readonly string[]).includes(value)
}

// Reordena LOCALES pondo o idioma da conta (Configurações → Conta) primeiro
// — usado nos seletores de bandeirinha (projeto, post, história, marcos,
// pontos de oração) pra sempre abrir/listar primeiro no idioma configurado
// como padrão do sistema, depois o restante.
export function orderLocalesByPreference(preferred: Locale): readonly Locale[] {
  return [preferred, ...LOCALES.filter((l) => l !== preferred)]
}
