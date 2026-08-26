'use client'

import { useState } from 'react'
import { BookOpen } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { BackButton } from '@/components/ui/back-button'

interface Props {
  triggerLabel: string
  title: string
  closeLabel: string
  children: React.ReactNode
}

// "História por trás do projeto" mudou de seção sempre visível na página
// pra um modal (pedido do usuário, a partir de um mockup) — o conteúdo (e,
// pro dono, a edição inline via LetterEditSection) continua o mesmo, só
// muda o container: fica escondido até alguém pedir pra ver, em vez de
// engordar a página por padrão.
export function ProjectStoryDialog({ triggerLabel, title, closeLabel, children }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={
        <button
          type="button"
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/10 hover:bg-primary/20 text-primary px-4 py-3 text-sm font-semibold transition-colors"
        >
          <BookOpen className="h-4 w-4" />
          {triggerLabel}
        </button>
      } />
      <DialogContent
        showCloseButton={false}
        className="fixed top-1/2 left-1/2 z-50 flex w-[calc(100%-2rem)] max-w-lg max-h-[85vh] -translate-x-1/2 -translate-y-1/2 flex-col gap-0 overflow-hidden rounded-2xl p-0"
      >
        <div className="grid grid-cols-[2rem_1fr_2rem] items-center gap-2 px-4 py-3 border-b shrink-0">
          <BackButton onClick={() => setOpen(false)} label={closeLabel} />
          <DialogTitle className="text-center text-base truncate">{title}</DialogTitle>
          <div />
        </div>
        <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-4">
          {children}
        </div>
      </DialogContent>
    </Dialog>
  )
}
