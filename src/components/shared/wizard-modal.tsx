'use client'

import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { BackButton } from '@/components/ui/back-button'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onRequestClose: () => void
  title: string
  closeLabel: string
  backLabel?: string
  onBack?: () => void
  rightLabel?: string
  onRight?: () => void
  rightDisabled?: boolean
  footer?: ReactNode
  children: ReactNode
}

/** Shell fullscreen reaproveitado por todo wizard estilo Instagram do app
 *  (composer de posts e de projetos): cabeçalho X/voltar + título + ação da
 *  direita ("Avançar"), corpo rolável, rodapé opcional pra erro inline. */
export function WizardModal({
  open, onOpenChange, onRequestClose, title, closeLabel, backLabel, onBack, rightLabel, onRight, rightDisabled, footer, children,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onRequestClose(); else onOpenChange(true) }}>
      <DialogContent
        showCloseButton={false}
        className="fixed inset-0 translate-x-0 translate-y-0 z-50 flex flex-col w-full h-full max-h-full max-w-none rounded-none p-0 gap-0 overflow-y-hidden"
      >
        <div className="grid grid-cols-[2rem_1fr_2rem] items-center gap-2 px-4 py-3 border-b shrink-0">
          {onBack ? (
            <BackButton onClick={onBack} label={backLabel ?? closeLabel} />
          ) : (
            <button type="button" onClick={onRequestClose} aria-label={closeLabel} className="text-muted-foreground hover:text-foreground">
              <X className="h-5 w-5" />
            </button>
          )}
          <DialogTitle className="text-center text-base truncate">{title}</DialogTitle>
          {onRight ? (
            <button
              type="button"
              onClick={onRight}
              disabled={rightDisabled}
              className="text-sm font-semibold text-primary disabled:opacity-40 justify-self-end"
            >
              {rightLabel}
            </button>
          ) : (
            <div />
          )}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-4 py-4">{children}</div>

        {footer}
      </DialogContent>
    </Dialog>
  )
}
