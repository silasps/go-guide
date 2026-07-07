'use client'

import { useLocale, useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { LOCALE_COOKIE, LOCALES, type Locale } from '@/i18n/config'

const LOCALE_FLAGS: Record<Locale, string> = {
  pt: '🇧🇷',
  en: '🇺🇸',
  es: '🇪🇸',
}

interface Props {
  className?: string
}

export function LanguageSwitcher({ className }: Props) {
  const locale = useLocale() as Locale
  const t = useTranslations('Nav')
  const router = useRouter()
  const [switching, setSwitching] = useState(false)

  async function handleSwitch(next: Locale) {
    if (next === locale || switching) return
    setSwitching(true)

    // Só afeta a navegação deste visitante nas páginas públicas (cookie).
    // Não grava em profiles.locale — mesmo se o visitante for o próprio
    // dono do perfil logado, isso não deve mudar o idioma da conta/dashboard
    // (essa preferência só é trocada em Configurações → Conta).
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000`

    router.refresh()
    setSwitching(false)
  }

  return (
    <div className={cn('flex items-center gap-0.5', className)} role="group" aria-label={t('selecionarIdioma')}>
      {LOCALES.map((l) => (
        <button
          key={l}
          onClick={() => handleSwitch(l)}
          disabled={switching}
          aria-pressed={l === locale}
          aria-label={l}
          className={cn(
            'h-7 w-7 flex items-center justify-center rounded-md text-base transition-opacity',
            l === locale ? 'opacity-100 ring-1 ring-foreground/15' : 'opacity-40 hover:opacity-70'
          )}
        >
          {LOCALE_FLAGS[l]}
        </button>
      ))}
    </div>
  )
}
