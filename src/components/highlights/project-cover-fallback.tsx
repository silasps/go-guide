import { ImageIcon } from 'lucide-react'
import { PROJECT_CATEGORIES } from '@/lib/highlights/project-categories'

interface Props {
  /** `highlights.category` — usa o emoji da primeira categoria escolhida
   *  quando existir, em vez de um ícone genérico. */
  category?: readonly string[] | null
  className?: string
}

// Preenche o espaço da capa em projetos antigos que foram publicados sem
// imagem (de antes da capa virar obrigatória na criação) — pensado pra
// ficar dentro de um container `relative` do mesmo tamanho da capa real
// (`fill`), nunca sozinho.
export function ProjectCoverFallback({ category, className }: Props) {
  const emoji = category?.length ? PROJECT_CATEGORIES.find((c) => c.value === category[0])?.emoji : null

  return (
    <div className={`absolute inset-0 flex items-center justify-center bg-gradient-to-br from-primary/15 via-muted to-support/15 ${className ?? ''}`}>
      {emoji ? (
        <span className="text-4xl" aria-hidden>{emoji}</span>
      ) : (
        <ImageIcon className="h-8 w-8 text-muted-foreground/40" aria-hidden />
      )}
    </div>
  )
}
