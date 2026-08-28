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

/** Shell reaproveitado por todo wizard estilo Instagram do app (composer de
 *  posts e de projetos): cabeçalho X/voltar + título + ação da direita
 *  ("Avançar"), corpo rolável, rodapé opcional pra erro inline. Painel
 *  ancorado na borda esquerda, altura cheia (a pedido do usuário — achou
 *  mais legal que um modal centralizado): no mobile ocupa a tela toda
 *  (igual antes, sem espaço pra mostrar nada "ao lado"); a partir de `sm:`
 *  vira um painel de largura fixa encostado à esquerda, com o resto do
 *  dashboard visível (e escurecido pelo overlay) à direita — cantos
 *  arredondados só do lado exposto (direito). Mais largo que os outros
 *  modais porque StepAdjust usa layout lado a lado (`md:flex-row`, um
 *  breakpoint de viewport, não do painel) — precisa de largura suficiente
 *  pra prévia + filtros não ficarem espremidos (mesmo problema que gerou o
 *  bug de largura do `sm:max-w-sm`, ver Changelog: `width` sozinho não
 *  basta, tem que cancelar o `max-width` embutido do `DialogContent` base
 *  também). */
export function WizardModal({
  open, onOpenChange, onRequestClose, title, closeLabel, backLabel, onBack, rightLabel, onRight, rightDisabled, footer, children,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onRequestClose(); else onOpenChange(true) }}>
      <DialogContent
        showCloseButton={false}
        className="fixed inset-y-0 left-0 top-0 translate-x-0 translate-y-0 z-50 flex flex-col w-full h-full max-h-full max-w-full sm:max-w-none sm:w-[600px] lg:w-[820px] rounded-none sm:rounded-r-2xl p-0 gap-0 overflow-hidden"
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
