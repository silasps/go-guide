'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { LanguageSwitcher } from '@/components/marketing/language-switcher'
import { AccountMenuDrawer, type DrawerProfile } from '@/components/dashboard/account-menu-drawer'
import { ArrowLeft } from 'lucide-react'

interface Props {
  username: string
  hasTrajectory: boolean
  canEdit: boolean
  ownerProfile: DrawerProfile | null
}

function BackToDashboard({ label }: { label: string }) {
  return (
    <Link
      href="/dashboard"
      aria-label={label}
      title={label}
      className="shrink-0 h-8 w-8 flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
    >
      <ArrowLeft className="h-4 w-4" />
    </Link>
  )
}

// Fluxos de ação/conversão (oração, parceria, mensagem) e a tela de um
// projeto específico não fazem parte da navegação por abas — mesma lógica
// do Instagram, onde compor uma mensagem ou abrir um post não mostra a
// barra de abas do perfil por cima. O LanguageSwitcher também mora aqui
// (em vez de flutuar solto em layout.tsx) pra nunca se sobrepor às abas —
// nas telas sem abas, ele volta a flutuar isolado no canto.
export function ProfileTabs({ username, hasTrajectory, canEdit, ownerProfile }: Props) {
  const pathname = usePathname()
  const t = useTranslations('PublicProfile')
  const base = `/${username}`

  const hiddenOn = [`${base}/mensagens`, `${base}/oracao`, `${base}/parceria`]
  const isProjectDetail = pathname.startsWith(`${base}/projetos/`)
  if (hiddenOn.includes(pathname) || isProjectDetail) {
    return (
      <div className="fixed top-3 inset-x-3 z-50 flex items-center justify-between">
        {canEdit ? <BackToDashboard label={t('backToDashboard')} /> : <span />}
        <LanguageSwitcher className="bg-background/90 backdrop-blur rounded-full ring-1 ring-foreground/10 shadow-sm p-1" />
      </div>
    )
  }

  const tabs = [
    { href: base, label: t('tabProfile'), exact: true },
    { href: `${base}/historia`, label: t('tabHistory'), exact: false },
    { href: `${base}/projetos`, label: t('tabProjects'), exact: false },
    ...(hasTrajectory ? [{ href: `${base}/trajetoria`, label: t('tabTrajectory'), exact: false }] : []),
  ]

  return (
    <div className="sticky top-0 z-40 bg-background/90 backdrop-blur border-b">
      <div className="max-w-xl mx-auto flex items-center gap-1">
        {canEdit && <BackToDashboard label={t('backToDashboard')} />}
        <nav className="flex-1 flex overflow-x-auto scrollbar-hide">
          {tabs.map(({ href, label, exact }) => {
            const active = exact ? pathname === href : pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex-1 text-center px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors',
                  active
                    ? 'border-foreground text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                )}
              >
                {label}
              </Link>
            )
          })}
        </nav>
        {canEdit && ownerProfile && (
          <div className="shrink-0 md:hidden">
            <AccountMenuDrawer profile={ownerProfile} />
          </div>
        )}
        <div className="shrink-0 pr-2">
          <LanguageSwitcher />
        </div>
      </div>
    </div>
  )
}
