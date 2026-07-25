'use client'

import { useTranslations } from 'next-intl'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onDiscard: () => void
}

export function DiscardConfirmDialog({ open, onOpenChange, onDiscard }: Props) {
  const t = useTranslations('PostComposer')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="z-[70]">
        <DialogHeader>
          <DialogTitle>{t('discardTitle')}</DialogTitle>
          <DialogDescription>{t('discardDescription')}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('discardCancel')}</Button>
          <Button variant="destructive" onClick={onDiscard}>{t('discardConfirm')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
