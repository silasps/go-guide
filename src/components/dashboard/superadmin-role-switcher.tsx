'use client'

import { useTranslations } from 'next-intl'
import { UserRole } from '@/types/database'
import { setPreviewRole } from '@/app/dashboard/actions'
import { usePendingAction } from '@/hooks/use-pending-action'
import { Button } from '@/components/ui/button'
import { Eye } from 'lucide-react'

interface Props {
  effectiveRole: UserRole
  isPreviewing: boolean
}

// Só renderizado quando isSuperAdmin(user.email) — ver dashboard/layout.tsx.
// Não impersona ninguém: só decide qual nav renderizar para o PRÓPRIO
// perfil ativo do superadmin, pra ver/testar as duas experiências com uma
// conta só (ver system.architecture.md §7 sobre o mecanismo completo).
export function SuperadminRoleSwitcher({ effectiveRole, isPreviewing }: Props) {
  const t = useTranslations('Superadmin')
  const { pendingValue, run } = usePendingAction<UserRole | 'reset'>()

  function switchTo(role: UserRole) {
    run(role, () => setPreviewRole(role))
  }

  function reset() {
    run('reset', () => setPreviewRole(null))
  }

  return (
    <div className="fixed bottom-16 md:bottom-3 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-full border bg-card shadow-lg px-3 py-1.5 text-xs">
      <Eye className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <span className="text-muted-foreground hidden sm:inline">{t('viewingAs')}</span>
      <Button
        size="xs"
        variant={effectiveRole === 'missionary' ? 'default' : 'ghost'}
        disabled={pendingValue !== null}
        onClick={() => switchTo('missionary')}
      >
        {t('missionary')}
      </Button>
      <Button
        size="xs"
        variant={effectiveRole === 'partner' ? 'default' : 'ghost'}
        disabled={pendingValue !== null}
        onClick={() => switchTo('partner')}
      >
        {t('partner')}
      </Button>
      {isPreviewing && (
        <Button size="xs" variant="outline" disabled={pendingValue !== null} onClick={reset}>
          {t('reset')}
        </Button>
      )}
    </div>
  )
}
