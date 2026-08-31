'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { coverThumbnailSrc } from '@/lib/media/bunny-thumbnail'
import { Highlight } from '@/types/database'
import { Button, buttonVariants } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { DeleteProjectDialog } from './delete-project-dialog'
import { ArchiveRestore, Pencil, Trash2 } from 'lucide-react'

export function ArchivedProjectsList({ highlights: initial }: { highlights: Highlight[] }) {
  const [highlights, setHighlights] = useState(initial)
  const [restoringId, setRestoringId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Highlight | null>(null)

  async function handleRestore(h: Highlight) {
    setRestoringId(h.id)
    const supabase = createClient()
    const { error } = await supabase.from('highlights').update({ archived_at: null }).eq('id', h.id)
    setRestoringId(null)
    if (error) { toast.error('Erro ao restaurar projeto.'); return }
    toast.success('Projeto restaurado.')
    setHighlights((prev) => prev.filter((x) => x.id !== h.id))
  }

  if (!highlights.length) {
    return <p className="text-center text-muted-foreground py-16">Nenhum projeto arquivado.</p>
  }

  return (
    <div className="space-y-3">
      {highlights.map((h) => (
        <div key={h.id} className="flex gap-4 p-4 border rounded-xl bg-card items-center">
          <div className="h-14 w-14 rounded-lg bg-muted overflow-hidden shrink-0">
            {h.cover_url
              ? <Image src={coverThumbnailSrc(h.cover_url)} alt={h.title} width={112} height={112} className="object-cover h-full w-full grayscale" style={{ objectPosition: h.cover_position ?? '50% 50%' }} />
              : <div className="h-full flex items-center justify-center text-xl">✨</div>
            }
          </div>

          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center gap-2">
              <p className="font-medium text-sm truncate">{h.title}</p>
              <Badge variant="secondary" className="text-xs shrink-0">Arquivado</Badge>
            </div>
            {h.archived_at && (
              <p className="text-xs text-muted-foreground">desde {new Date(h.archived_at).toLocaleDateString('pt-BR')}</p>
            )}
          </div>

          <div className="flex items-center gap-0.5 shrink-0">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleRestore(h)} disabled={restoringId === h.id} title="Restaurar">
              <ArchiveRestore className="h-3.5 w-3.5" />
            </Button>
            <Link href={`/dashboard/projetos/${h.id}`} className={cn(buttonVariants({ variant: 'ghost', size: 'icon' }), 'h-7 w-7')} title="Editar">
              <Pencil className="h-3.5 w-3.5" />
            </Link>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(h)} title="Excluir definitivamente">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      ))}

      {deleteTarget && (
        <DeleteProjectDialog
          open={!!deleteTarget}
          onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}
          projectId={deleteTarget.id}
          projectTitle={deleteTarget.title}
          onDeleted={() => setHighlights((prev) => prev.filter((x) => x.id !== deleteTarget.id))}
        />
      )}
    </div>
  )
}
