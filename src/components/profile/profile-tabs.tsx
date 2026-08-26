'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { LanguageSwitcher } from '@/components/marketing/language-switcher'
import { AccountMenuDrawer, type DrawerProfile } from '@/components/dashboard/account-menu-drawer'
import { BackButton } from '@/components/ui/back-button'
import { useHideOnScroll } from '@/hooks/use-hide-on-scroll'
import { User, BookOpen, FolderOpen, Trophy } from 'lucide-react'

interface Props {
  username: string
  hasTrajectory: boolean
  isMissionary: boolean
  canEdit: boolean
  viewerUserId: string | null
  ownerProfile: DrawerProfile | null
}

// Fluxos de ação/conversão (oração, parceria, mensagem) não fazem parte da
// navegação por abas — mesma lógica do Instagram, onde compor uma mensagem
// não mostra a barra de abas do perfil por cima. A página de um projeto
// específico já mostrou a barra normal (pedido do usuário, pra dar pra
// navegar pro resto do perfil sem ter que voltar primeiro). O
// LanguageSwitcher também mora aqui (em vez de flutuar solto em
// layout.tsx) pra nunca se sobrepor às abas — nas telas sem abas, ele volta
// a flutuar isolado no canto, ao lado do único botão de voltar (fixo,
// discreto) dessas telas.
export function ProfileTabs({ username, hasTrajectory, isMissionary, canEdit, viewerUserId, ownerProfile }: Props) {
  const pathname = usePathname()
  const t = useTranslations('PublicProfile')
  const base = `/${username}`
  const hidden = useHideOnScroll()

  // A página de um projeto específico deixou de ser tratada como "fluxo de
  // ação sem chrome" (tipo mandar mensagem) — o usuário pediu que ela
  // mostre a barra de abas normal (Perfil/História/Projetos), pra dar pra
  // navegar pro resto do perfil sem precisar voltar primeiro. Antes tinha
  // um caso especial aqui só com botão de voltar fixo sobre a capa.

  // /parceria ficou 100% dono da própria chrome (cabeçalho + rodapé fixos
  // do próprio wizard, ver partnership-wizard.tsx/pledge-form.tsx) — evita
  // dois cabeçalhos fixos disputando o mesmo topo de tela.
  if (pathname === `${base}/parceria`) return null

  const contentMaxWidth: Record<string, string> = {
    [`${base}/mensagens`]: 'max-w-lg',
    [`${base}/oracao`]: 'max-w-md',
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
    { href: base, label: t('tabProfile'), exact: true, Icon: User },
    ...(isMissionary ? [{ href: `${base}/historia`, label: t('tabHistory'), exact: false, Icon: BookOpen }] : []),
    ...(isMissionary ? [{ href: `${base}/projetos`, label: t('tabProjects'), exact: false, Icon: FolderOpen }] : []),
    ...(isMissionary && hasTrajectory ? [{ href: `${base}/trajetoria`, label: t('tabTrajectory'), exact: false, Icon: Trophy }] : []),
  ]

  return (
    <div
      className={cn(
        'sticky top-0 z-40 bg-background/90 backdrop-blur border-b transition-transform duration-300',
        hidden ? '-translate-y-full' : 'translate-y-0'
      )}
    >
      <div className="max-w-xl mx-auto flex items-center gap-1">
        <BackButton
          href={viewerUserId ? '/dashboard' : '/explorar'}
          label={viewerUserId ? t('backToDashboard') : t('backToHome')}
          className="shrink-0"
        />
        <nav className="flex-1 flex overflow-x-auto scrollbar-hide">
          {tabs.map(({ href, label, exact, Icon }) => {
            const active = exact ? pathname === href : pathname.startsWith(href)
            return (
              // `replace`: trocar de aba (Perfil/História/Projetos) não deve
              // empilhar histórico — o `BackButton` acima usa `router.back()`
              // de verdade, então sem isso "voltar" ficava saltando de aba em
              // aba em vez de sair direto pra onde a pessoa veio (feedback
              // direto do usuário, que ficou "preso" alternando entre abas).
              <Link
                key={href}
                href={href}
                replace
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors',
                  active
                    ? 'border-foreground text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                )}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
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
