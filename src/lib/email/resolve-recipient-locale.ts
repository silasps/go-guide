import type { createServiceClient } from '@/lib/supabase/server'
import { isLocale, type Locale } from '@/i18n/config'

type ServiceClient = Awaited<ReturnType<typeof createServiceClient>>

/** Idioma de um e-mail transacional pra quem pode ou não ter conta: com
 *  conta (`accountUserId` = `reporter_user_id`/`partners.user_id`),
 *  `profiles.locale` é a fonte da verdade (o que a pessoa escolheu em
 *  Configurações vale mais que o que capturamos no formulário uma vez);
 *  sem conta, cai pro `reporter_locale`/`locale` capturado no cadastro
 *  (migration 103) e, na ausência dele (linha antiga, de antes da coluna
 *  existir), pro PT que já era o comportamento fixo de todo e-mail pra
 *  convidado até aqui — nunca quebra pra quem já estava recebendo. */
export async function resolveRecipientLocale(
  supabase: ServiceClient,
  accountUserId: string | null | undefined,
  guestLocale: string | null | undefined
): Promise<Locale> {
  if (accountUserId) {
    const { data } = await supabase.from('profiles').select('locale').eq('user_id', accountUserId).maybeSingle()
    if (isLocale(data?.locale)) return data.locale
  }
  return isLocale(guestLocale) ? guestLocale : 'pt'
}
