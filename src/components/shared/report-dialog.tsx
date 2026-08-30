'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { reportContent } from '@/app/dashboard/publicacoes/report-actions'
import type { ReportReason, ReportTargetType } from '@/types/database'

const REASONS: ReportReason[] = ['nudity', 'hate_speech', 'harassment', 'spam', 'impersonation', 'other']

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  targetType: ReportTargetType
  targetId: string
}

export function ReportDialog({ open, onOpenChange, targetType, targetId }: Props) {
  const t = useTranslations('Report')
  const [reason, setReason] = useState<ReportReason | null>(null)
  const [details, setDetails] = useState('')
  const [sending, setSending] = useState(false)

  async function handleSubmit() {
    if (!reason) return
    setSending(true)
    try {
      await reportContent(targetType, targetId, reason, details)
      toast.success(t('reportSent'))
      onOpenChange(false)
      setReason(null)
      setDetails('')
    } catch {
      toast.error(t('reportError'))
    } finally {
      setSending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t('reportTitle')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {REASONS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setReason(r)}
                className={cn(
                  'text-sm px-3 py-2 rounded-lg border text-left transition-colors',
                  reason === r ? 'border-primary bg-primary/5 text-foreground' : 'border-border hover:bg-muted'
                )}
              >
                {t(`reason_${r}`)}
              </button>
            ))}
          </div>
          <Textarea
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            placeholder={t('detailsPlaceholder')}
            rows={3}
          />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t('cancel')}</Button>
          <Button type="button" onClick={handleSubmit} disabled={!reason || sending}>{t('submit')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
