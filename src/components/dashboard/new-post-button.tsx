'use client'

import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { useComposer } from '@/components/dashboard/post-composer-provider'
import { cn } from '@/lib/utils'
import { Plus } from 'lucide-react'

export function NewPostButton({ className }: { className?: string }) {
  const t = useTranslations('DashboardOverview')
  const { openComposer } = useComposer()

  return (
    <Button onClick={() => openComposer()} className={cn('gap-2 shrink-0', className)}>
      <Plus className="h-4 w-4" />
      <span className="hidden sm:inline">{t('newPost')}</span>
    </Button>
  )
}
