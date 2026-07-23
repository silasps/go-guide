import { getRequestConfig } from 'next-intl/server'
import { cookies, headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, type Locale } from './config'

// Ex: "pt-BR,en;q=0.9,es;q=0.8" -> ['pt', 'en', 'es'], na ordem de preferência
// do navegador. Sem dependência nova (negotiator não está instalado) —
// parsing simples é suficiente pro nosso conjunto fixo de 3 idiomas.
function parseAcceptLanguage(header: string | null): Locale | undefined {
  if (!header) return undefined
  const preferred = header
    .split(',')
    .map((part) => part.split(';')[0].trim().split('-')[0].toLowerCase())
  return preferred.find(isLocale)
}

export default getRequestConfig(async () => {
  let locale: Locale | undefined

  // Usuário logado: profiles.locale (preferência da conta) sempre manda,
  // independente de qualquer cookie deixado por uma visita anterior a uma
  // página pública — a conta segue o dono em qualquer lugar do site.
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    const { data: profile } = await supabase.from('profiles').select('locale').eq('user_id', user.id).single()
    if (isLocale(profile?.locale)) locale = profile.locale
  }

  // Visitante anônimo (sem sessão): usa o cookie, que é a preferência
  // pessoal dele para navegar páginas públicas.
  if (!locale) {
    const cookieStore = await cookies()
    const cookieLocale = cookieStore.get(LOCALE_COOKIE)?.value
    if (isLocale(cookieLocale)) locale = cookieLocale
  }

  // Primeira visita, sem cookie ainda: usa o idioma preferido do navegador
  // em vez de cair direto no fallback fixo.
  if (!locale) {
    const headerList = await headers()
    locale = parseAcceptLanguage(headerList.get('accept-language'))
  }

  if (!locale) locale = DEFAULT_LOCALE

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  }
})
