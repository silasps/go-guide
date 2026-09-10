'use client'

import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { BackButton } from '@/components/ui/back-button'
import { cn } from '@/lib/utils'

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
  /** 'panel' (default) — ancorado na borda esquerda, altura cheia a partir
   *  de `sm:` (composer de post/projeto novo, parceria — a pedido do
   *  usuário, "achou mais legal que um modal centralizado"). 'centered' —
   *  janela flutuante centralizada com altura própria a partir de `sm:`
   *  (editor de projeto, pedido posterior do usuário vendo o painel
   *  "preso na lateral" em tela grande) — no mobile os dois se comportam
   *  igual (tela cheia). */
  variant?: 'panel' | 'centered'
}

/** Shell reaproveitado por todo wizard estilo Instagram do app (composer de
 *  posts, de projetos, parceria, editor de projeto): cabeçalho X/voltar +
 *  título + ação da direita ("Avançar"), corpo rolável, rodapé opcional
 *  pra erro inline. No mobile sempre ocupa a tela toda (sem espaço pra
 *  mostrar nada "ao lado"); a partir de `sm:` a posição depende de
 *  `variant` (ver comentário da prop). Mais largo que os outros modais
 *  porque StepAdjust usa layout lado a lado (`md:flex-row`, um breakpoint
 *  de viewport, não do painel) — precisa de largura suficiente pra prévia
 *  + filtros não ficarem espremidos (mesmo problema que gerou o bug de
 *  largura do `sm:max-w-sm`, ver Changelog: `width` sozinho não basta,
 *  tem que cancelar o `max-width` embutido do `DialogContent` base
 *  também). */
export function WizardModal({
  open, onOpenChange, onRequestClose, title, closeLabel, backLabel, onBack, rightLabel, onRight, rightDisabled, footer, children,
  variant = 'panel',
}: Props) {
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onRequestClose(); else onOpenChange(true) }}>
      <DialogContent
        showCloseButton={false}
        className={cn(
          'fixed inset-y-0 left-0 top-0 translate-x-0 translate-y-0 z-50 flex flex-col w-full h-full max-h-full max-w-full rounded-none p-0 gap-0 overflow-hidden sm:max-w-none sm:w-[600px] lg:w-[820px]',
          variant === 'panel'
            ? 'sm:rounded-r-2xl'
            : 'sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:h-auto sm:max-h-[85vh] sm:rounded-2xl'
        )}
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
