'use client'

import { useScrolledPastElement } from '@/hooks/use-scrolled-past-element'

interface Props {
  targetId: string
  label?: string
}

// Atalho flutuante pra voltar à área de apoio depois que ela já saiu da
// tela — a página é longa e o CTA "de verdade" (com o detalhamento por
// categoria) fica lá em cima, não no fim. Clicar rola de volta pra ele em
// vez de duplicar o formulário/lista de categorias aqui.
export function FloatingSupportCta({ targetId, label = '💰 Apoiar este projeto' }: Props) {
  const visible = useScrolledPastElement(targetId)
  if (!visible) return null

  function handleClick() {
    document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-full border bg-card shadow-lg px-4 py-2.5 text-sm font-medium hover:bg-muted/50 transition-colors"
    >
      {label}
    </button>
  )
}
