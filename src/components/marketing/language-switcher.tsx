'use client'

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { usePendingAction } from '@/hooks/use-pending-action'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { LOCALE_COOKIE, LOCALES, type Locale } from '@/i18n/config'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from '@/components/ui/dropdown-menu'
import { ChevronDown, Globe, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

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
  // Renderiza como DropdownMenuSub em vez de DropdownMenu completo — pra
  // ser embutido dentro de outro DropdownMenu pai (ver ProfileMoreMenu).
  submenu?: boolean
}

export function LanguageSwitcher({ className, compact = false, submenu = false }: Props) {
  const locale = useLocale() as Locale
  const t = useTranslations('Nav')
  const tAccount = useTranslations('AccountForm')
  const router = useRouter()
  const { isPending: switching, run } = usePendingAction()
  const [pendingLocale, setPendingLocale] = useState<Locale | null>(null)

  function handleSwitch(next: Locale) {
    if (next === locale || switching) return
    setPendingLocale(next)
    run(true, async () => {
      // Cookie cobre o visitante anônimo (ver src/i18n/request.ts). Se
      // houver usuário logado, profiles.locale sempre manda por cima do
      // cookie — então também precisa ser atualizado aqui, senão o troca
      // some no próximo refresh (a conta segue o dono em qualquer lugar do
      // site, não só nesta página pública).
      document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000`

      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { error } = await supabase.from('profiles').update({ locale: next }).eq('user_id', user.id)
        if (error) toast.error(tAccount('errorSaveLocale'))
      }

      router.refresh()
    })
  }

  if (submenu) {
    return (
      <DropdownMenuSub>
        <DropdownMenuSubTrigger disabled={switching} className="gap-2">
          {switching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Globe className="h-4 w-4" />}
          {t('selecionarIdioma')}
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent>
          {LOCALES.map((l) => (
            <DropdownMenuItem key={l} onClick={() => handleSwitch(l)} className="gap-2">
              <span>{LOCALE_FLAGS[l]}</span>
              <span className={l === locale ? 'font-medium' : ''}>{l.toUpperCase()}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuSubContent>
      </DropdownMenuSub>
    )
  }

  if (compact) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={t('selecionarIdioma')}
          disabled={switching}
          className={cn('flex items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground transition-colors', className)}
        >
          {(pendingLocale ?? locale).toUpperCase()}
          {switching ? <Loader2 className="h-3 w-3 animate-spin" /> : <ChevronDown className="h-3 w-3" />}
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
    <div className={cn('flex items-center gap-0.5', switching && 'opacity-60', className)} role="group" aria-label={t('selecionarIdioma')}>
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
          {switching && l === pendingLocale ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : LOCALE_FLAGS[l]}
        </button>
      ))}
    </div>
  )
}
