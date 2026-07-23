'use client'

import { useTranslations } from 'next-intl'
import { Compass, Loader2 } from 'lucide-react'
import { becomeMissionary } from '@/app/dashboard/actions'
import { usePendingAction } from '@/hooks/use-pending-action'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

// Convite pra virar missionário — reaproveitado nas áreas onde um apoiador
// realmente passa (meus-projetos, descoberta), não só escondido em
// Configurações → Conta (feedback direto do usuário).
export function BecomeMissionaryCard({ className }: { className?: string }) {
  const t = useTranslations('BecomeMissionary')
  const { isPending, run } = usePendingAction()

  return (
    <Card className={cn('border-dashed', className)}>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Compass className="h-4 w-4 shrink-0" />
          {t('cardTitle')}
        </CardTitle>
        <CardDescription>{t('cardDescription')}</CardDescription>
      </CardHeader>
      <CardContent>
        <Button
          variant="outline"
          disabled={isPending}
          onClick={() => run(true, async () => { await becomeMissionary() })}
        >
          {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {t('cta')}
        </Button>
      </CardContent>
    </Card>
  )
}
