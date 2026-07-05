import { getRequestConfig } from 'next-intl/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, type Locale } from './config'

export default getRequestConfig(async () => {
  const cookieStore = await cookies()
  let locale: Locale | undefined
  const cookieLocale = cookieStore.get(LOCALE_COOKIE)?.value
  if (isLocale(cookieLocale)) locale = cookieLocale

  if (!locale) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: profile } = await supabase.from('profiles').select('locale').eq('user_id', user.id).single()
      if (isLocale(profile?.locale)) locale = profile.locale
    }
  }

  if (!locale) locale = DEFAULT_LOCALE

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  }
})
