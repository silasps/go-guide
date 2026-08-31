'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { DeleteProjectDialog } from './delete-project-dialog'
import { Trash2 } from 'lucide-react'

interface Props {
  projectId: string
  projectTitle: string
  redirectHref: string
}

// Botão de excluir "de dentro do projeto" (página pública, canEdit) —
// pedido do usuário: antes só dava pra excluir pela listagem ou pela tela
// de edição do dashboard, não de dentro da própria página do projeto.
export function DeleteProjectButton({ projectId, projectTitle, redirectHref }: Props) {
  const t = useTranslations('DeleteProjectDialog')
  const router = useRouter()
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-8 w-8 shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
        onClick={() => setOpen(true)}
        aria-label={t('title')}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
      <DeleteProjectDialog
        open={open}
        onOpenChange={setOpen}
        projectId={projectId}
        projectTitle={projectTitle}
        onDeleted={() => { router.push(redirectHref); router.refresh() }}
      />
    </>
  )
}
