'use client'

import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { useComposer } from '@/components/dashboard/post-composer-provider'
import { Plus } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export function NewPostQuickAction({ label, description, icon: Icon }: { label: string; description: string; icon: LucideIcon }) {
  const { openComposer } = useComposer()
  return (
    <button
      onClick={() => openComposer()}
      className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-muted transition-colors group w-full text-left"
    >
      <div className="p-1.5 bg-muted rounded-md shrink-0 group-hover:bg-background transition-colors">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium leading-tight">{label}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
    </button>
  )
}

export function NewPostEmptyCta() {
  const t = useTranslations('DashboardOverview')
  const { openComposer } = useComposer()
  return (
    <Button size="sm" className="mt-3 gap-1.5" onClick={() => openComposer()}>
      <Plus className="h-3.5 w-3.5" />
      {t('createFirstPost')}
    </Button>
  )
}
