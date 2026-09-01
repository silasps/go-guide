'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { BackButton } from '@/components/ui/back-button'

const TABS = [
  { href: '/superadmin', key: 'navDashboard' },
  { href: '/superadmin/moderacao', key: 'navModeration' },
  { href: '/superadmin/usuarios', key: 'navUsers' },
] as const

export function SuperadminNav() {
  const t = useTranslations('Superadmin')
  const pathname = usePathname()

  return (
    <div className="border-b bg-card">
      <div className="max-w-3xl mx-auto px-4 flex items-center gap-1 overflow-x-auto">
        {/* BackButton precisa de distância da borda esquerda: no iOS
            (Safari/WebView), a borda é reservada pro gesto de "voltar" do
            sistema, que compete com o toque e engole o clique (mesmo motivo
            documentado em ui/back-button.tsx e profile-tabs.tsx). */}
        <BackButton href="/dashboard" label={t('backToApp')} className="shrink-0" />
        {TABS.map((tab) => {
          const active = pathname === tab.href
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                'px-3 py-3 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors',
                active ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              {t(tab.key)}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
