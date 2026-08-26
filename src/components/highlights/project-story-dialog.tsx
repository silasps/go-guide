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
      {/* Cresce com a tela sem tocar no top/left/translate padrão do
          DialogContent (é o que já centraliza corretamente) — só
          max-width/max-height responsivos por cima. Uma tentativa anterior
          trocou isso por `inset-x-*` + cancelar `left`/`translate` na mão,
          e o Tailwind não resolveu o conflito de forma confiável entre as
          duas técnicas de posicionamento (estourava a tela em celular
          real). `w-full` (do componente base) + `max-w-*` é o padrão
          normal do Tailwind pra "cresce até um teto", sem esse risco. */}
      <DialogContent
        showCloseButton={false}
        className="max-w-[calc(100%-1.5rem)] max-h-[75vh] sm:max-w-xl sm:max-h-[80vh] lg:max-w-2xl lg:max-h-[85vh] flex flex-col gap-0 overflow-hidden rounded-2xl p-0"
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
