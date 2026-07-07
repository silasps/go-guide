import { getRequestConfig } from 'next-intl/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, type Locale } from './config'

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

  if (!locale) locale = DEFAULT_LOCALE

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  }
})
