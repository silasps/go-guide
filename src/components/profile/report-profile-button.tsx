'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Flag } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ReportDialog } from '@/components/shared/report-dialog'

export function ReportProfileButton({ profileId }: { profileId: string }) {
  const t = useTranslations('Report')
  const [open, setOpen] = useState(false)

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'gap-1.5 text-muted-foreground text-xs')}>
        <Flag className="h-3 w-3" />
        {t('reportProfile')}
      </button>
      <ReportDialog open={open} onOpenChange={setOpen} targetType="profile" targetId={profileId} />
    </>
  )
}
