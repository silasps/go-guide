'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { LanguageSwitcher } from '@/components/marketing/language-switcher'
import { AccountMenuDrawer, type DrawerProfile } from '@/components/dashboard/account-menu-drawer'
import { BackButton } from '@/components/ui/back-button'

interface Props {
  username: string
  hasTrajectory: boolean
  isMissionary: boolean
  canEdit: boolean
  viewerUserId: string | null
  ownerProfile: DrawerProfile | null
}

// Fluxos de ação/conversão (oração, parceria, mensagem) e a tela de um
// projeto específico não fazem parte da navegação por abas — mesma lógica
// do Instagram, onde compor uma mensagem ou abrir um post não mostra a
// barra de abas do perfil por cima. O LanguageSwitcher também mora aqui
// (em vez de flutuar solto em layout.tsx) pra nunca se sobrepor às abas —
// nas telas sem abas, ele volta a flutuar isolado no canto, ao lado do
// único botão de voltar (fixo, discreto) dessas telas.
export function ProfileTabs({ username, hasTrajectory, isMissionary, canEdit, viewerUserId, ownerProfile }: Props) {
  const pathname = usePathname()
  const t = useTranslations('PublicProfile')
  const base = `/${username}`

  const isProjectDetail = pathname.startsWith(`${base}/projetos/`)
  if (isProjectDetail) {
    // Foto de capa em tela cheia: botão fica fixo no canto, como em
    // visualizadores de foto (Instagram), com sombra pra ficar legível
    // sobre qualquer imagem por baixo.
    return (
      <div className="fixed top-3 inset-x-3 z-50 flex items-center justify-between">
        <BackButton href={base} label={t('backToProfile')} className="drop-shadow-[0_1px_3px_rgba(0,0,0,0.6)]" />
        <LanguageSwitcher compact className="bg-background/90 backdrop-blur rounded-full ring-1 ring-foreground/10 shadow-sm px-2 py-1" />
      </div>
    )
  }

  const contentMaxWidth: Record<string, string> = {
    [`${base}/mensagens`]: 'max-w-lg',
    [`${base}/oracao`]: 'max-w-md',
    [`${base}/parceria`]: 'max-w-md',
  }
  if (pathname in contentMaxWidth) {
    // Alinha o botão de voltar com a coluna de conteúdo centralizada da
    // página, em vez de grudar no canto esquerdo da tela (feedback direto
    // do usuário).
    return (
      <div className="fixed top-3 inset-x-0 z-50 px-4">
        <div className={cn('mx-auto flex items-center justify-between', contentMaxWidth[pathname])}>
          <BackButton href={base} label={t('backToProfile')} />
          <LanguageSwitcher compact />
        </div>
      </div>
    )
  }

  // História/Projetos/Trajetória são conceitos de missionário (jornada,
  // campanhas de arrecadação) — no perfil de um apoiador/parceiro só fazem
  // sentido a aba de Perfil mesmo, senão parece que ele também "é" um
  // missionário (feedback direto do usuário).
  const tabs = [
    { href: base, label: t('tabProfile'), exact: true },
    ...(isMissionary ? [{ href: `${base}/historia`, label: t('tabHistory'), exact: false }] : []),
    ...(isMissionary ? [{ href: `${base}/projetos`, label: t('tabProjects'), exact: false }] : []),
    ...(isMissionary && hasTrajectory ? [{ href: `${base}/trajetoria`, label: t('tabTrajectory'), exact: false }] : []),
  ]

  return (
    <div className="sticky top-0 z-40 bg-background/90 backdrop-blur border-b">
      <div className="max-w-xl mx-auto flex items-center gap-1">
        {viewerUserId && <BackButton href="/dashboard" label={t('backToDashboard')} className="shrink-0" />}
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
          <LanguageSwitcher compact />
        </div>
      </div>
    </div>
  )
}
