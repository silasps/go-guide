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
          className="inline-flex items-center gap-2 rounded-full bg-secondary/15 hover:bg-secondary/25 text-secondary px-4 py-2.5 text-sm font-medium transition-colors"
        >
          <BookOpen className="h-4 w-4" />
          {triggerLabel}
        </button>
      } />
      <DialogContent
        showCloseButton={false}
        className="fixed inset-0 translate-x-0 translate-y-0 z-50 flex flex-col w-full h-full max-h-full overflow-y-hidden max-w-none sm:max-w-none rounded-none p-0 gap-0 md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:flex-none md:w-full md:h-auto md:max-w-lg md:max-h-[85vh] md:rounded-xl md:p-0 md:gap-0"
      >
        <div className="grid grid-cols-[2rem_1fr_2rem] items-center gap-2 px-4 py-3 border-b shrink-0">
          <BackButton onClick={() => setOpen(false)} label={closeLabel} />
          <DialogTitle className="text-center text-base truncate">{title}</DialogTitle>
          <div />
        </div>
        <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-4 md:px-5 md:py-5">
          {children}
        </div>
      </DialogContent>
    </Dialog>
  )
}
