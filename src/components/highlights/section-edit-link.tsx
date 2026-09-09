import Link from 'next/link'
import { Pencil } from 'lucide-react'

interface Props {
  canEdit: boolean
  highlightId: string
  label: string
  children: React.ReactNode
}

// Substitui as antigas *-edit-section.tsx (edição inline com formulário
// próprio por seção) — agora um único caminho de edição, o editor de
// projeto (etapa "Revisão", ver project-editor-modal.tsx), sempre aberto
// via navegação normal (não precisa de 'use client', é só um Link).
export function SectionEditLink({ canEdit, highlightId, label, children }: Props) {
  if (!canEdit) return <>{children}</>
  return (
    <div className="group relative">
      {children}
      <Link
        href={`/dashboard/projetos/${highlightId}`}
        aria-label={label}
        title={label}
        className="absolute top-0 right-0 h-7 w-7 flex items-center justify-center rounded-full bg-background/90 backdrop-blur ring-1 ring-foreground/10 text-muted-foreground hover:text-foreground transition-colors"
      >
        <Pencil className="h-3.5 w-3.5" />
      </Link>
    </div>
  )
}
