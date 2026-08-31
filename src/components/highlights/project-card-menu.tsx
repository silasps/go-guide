'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { DeleteProjectDialog } from './delete-project-dialog'
import { FolderOpen, Pencil, Eye, EyeOff, Archive, Trash2, MoreVertical, ChevronUp, ChevronDown } from 'lucide-react'
import type { HighlightStatus } from '@/types/database'

interface Props {
  projectId: string
  projectTitle: string
  status: HighlightStatus
  openHref: string
  editHref: string
  onMoveUp?: () => void
  onMoveDown?: () => void
}

// Menu de ações rápidas sobre o card do projeto (listagem pública,
// `[username]/projetos`) — pedido do usuário: excluir/editar/publicar
// direto da grade, sem precisar entrar no dashboard. Fica fora do <Link>
// que cobre o card (irmão dele, posicionado por cima via `absolute`), não
// aninhado dentro — evita qualquer conflito de clique com a navegação do
// card (o menu abre num portal de qualquer forma, mas o botão-gatilho em
// si não é, então ficar fora do <Link> é o jeito simples de garantir que
// abrir o menu nunca dispara a navegação do card por baixo).
export function ProjectCardMenu({ projectId, projectTitle, status, openHref, editHref, onMoveUp, onMoveDown }: Props) {
  const t = useTranslations('ProjectQuickActions')
  const router = useRouter()
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [toggling, setToggling] = useState(false)
  const [archiving, setArchiving] = useState(false)

  async function toggleStatus() {
    if (toggling) return
    setToggling(true)
    const nextStatus = status === 'active' ? 'hidden' : 'active'
    const supabase = createClient()
    const { error } = await supabase.from('highlights').update({ status: nextStatus }).eq('id', projectId)
    setToggling(false)
    if (error) { toast.error(t('toggleError')); return }
    toast.success(nextStatus === 'active' ? t('published') : t('unpublished'))
    router.refresh()
  }

  // Arquivar mantém o histórico (transações, doações etc. continuam
  // ligadas ao projeto) mas some da listagem e da página pública — pedido
  // do usuário como alternativa não destrutiva a excluir de vez.
  async function handleArchive() {
    if (archiving) return
    setArchiving(true)
    const supabase = createClient()
    const { error } = await supabase.from('highlights').update({ archived_at: new Date().toISOString() }).eq('id', projectId)
    setArchiving(false)
    if (error) { toast.error(t('archiveError')); return }
    toast.success(t('archived'))
    router.refresh()
  }

  return (
    <>
      <div className="absolute top-2 right-2 z-10">
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label={t('menuLabel')}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-background/90 backdrop-blur text-foreground shadow-sm hover:bg-background transition-colors"
          >
            <MoreVertical className="h-3.5 w-3.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {(onMoveUp || onMoveDown) && (
              <>
                <DropdownMenuItem onClick={onMoveUp} disabled={!onMoveUp} className="gap-2">
                  <ChevronUp className="h-3.5 w-3.5" />
                  {t('moveUp')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onMoveDown} disabled={!onMoveDown} className="gap-2">
                  <ChevronDown className="h-3.5 w-3.5" />
                  {t('moveDown')}
                </DropdownMenuItem>
              </>
            )}
            <DropdownMenuItem onClick={() => router.push(openHref)} className="gap-2">
              <FolderOpen className="h-3.5 w-3.5" />
              {t('open')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push(editHref)} className="gap-2">
              <Pencil className="h-3.5 w-3.5" />
              {t('edit')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={toggleStatus} className="gap-2">
              {status === 'active' ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              {status === 'active' ? t('unpublish') : t('publish')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleArchive} className="gap-2">
              <Archive className="h-3.5 w-3.5" />
              {t('archive')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setDeleteOpen(true)} variant="destructive" className="gap-2">
              <Trash2 className="h-3.5 w-3.5" />
              {t('delete')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <DeleteProjectDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        projectId={projectId}
        projectTitle={projectTitle}
        onDeleted={() => router.refresh()}
      />
    </>
  )
}
