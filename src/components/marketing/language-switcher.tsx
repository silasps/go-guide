'use client'

import { useLocale, useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { usePendingAction } from '@/hooks/use-pending-action'
import { cn } from '@/lib/utils'
import { LOCALE_COOKIE, LOCALES, type Locale } from '@/i18n/config'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
import { ChevronDown } from 'lucide-react'

const LOCALE_FLAGS: Record<Locale, string> = {
  pt: '🇧🇷',
  en: '🇺🇸',
  es: '🇪🇸',
}

interface Props {
  className?: string
  // Rótulo de texto discreto ("PT ▾") em vez das 3 bandeiras — usado em
  // telas de conteúdo (perfil público) onde um seletor grande demais
  // competiria com o conteúdo principal. Nenhum app de peso (Instagram,
  // WhatsApp, X...) expõe troca de idioma na tela principal; isso é o
  // meio-termo entre "escondido" e "chamativo".
  compact?: boolean
}

export function LanguageSwitcher({ className, compact = false }: Props) {
  const locale = useLocale() as Locale
  const t = useTranslations('Nav')
  const router = useRouter()
  const { isPending: switching, run } = usePendingAction()

  function handleSwitch(next: Locale) {
    if (next === locale || switching) return
    run(true, () => {
      // Só afeta a navegação deste visitante nas páginas públicas (cookie).
      // Não grava em profiles.locale — mesmo se o visitante for o próprio
      // dono do perfil logado, isso não deve mudar o idioma da conta/dashboard
      // (essa preferência só é trocada em Configurações → Conta).
      document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000`
      router.refresh()
    })
  }

  if (compact) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={t('selecionarIdioma')}
          disabled={switching}
          className={cn('flex items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground transition-colors', className)}
        >
          {locale.toUpperCase()}
          <ChevronDown className="h-3 w-3" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {LOCALES.map((l) => (
            <DropdownMenuItem key={l} onClick={() => handleSwitch(l)} className="gap-2">
              <span>{LOCALE_FLAGS[l]}</span>
              <span className={l === locale ? 'font-medium' : ''}>{l.toUpperCase()}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    )
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
