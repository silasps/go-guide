'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase/client'
import { Loader2, TriangleAlert } from 'lucide-react'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  projectTitle: string
  onDeleted: () => void
}

// Confirmação reforçada pra excluir um projeto — pedido do usuário: em vez
// do window.confirm() genérico usado antes, exige digitar o nome exato do
// projeto (mesmo padrão de "digite EXCLUIR" já usado em /conta/excluir,
// adaptado pra usar o nome do projeto em vez de uma palavra fixa).
export function DeleteProjectDialog({ open, onOpenChange, projectId, projectTitle, onDeleted }: Props) {
  const t = useTranslations('DeleteProjectDialog')
  const [confirmText, setConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const matches = confirmText.trim().length > 0 && confirmText.trim() === projectTitle.trim()

  function handleOpenChange(next: boolean) {
    onOpenChange(next)
    if (!next) setConfirmText('')
  }

  async function handleDelete() {
    if (!matches) return
    setDeleting(true)
    const supabase = createClient()
    const { error } = await supabase.from('highlights').delete().eq('id', projectId)
    setDeleting(false)
    if (error) { toast.error(t('error')); return }
    toast.success(t('success'))
    handleOpenChange(false)
    onDeleted()
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <TriangleAlert className="h-4 w-4 shrink-0" />
            {t('title')}
          </DialogTitle>
          <DialogDescription>{t('warning')} {t('sideEffectNote')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="delete-project-confirm">{t('confirmInstruction', { name: projectTitle })}</Label>
          <Input
            id="delete-project-confirm"
            value={confirmText}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfirmText(e.target.value)}
            placeholder={projectTitle}
            autoComplete="off"
          />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>{t('cancel')}</Button>
          <Button type="button" variant="destructive" onClick={handleDelete} disabled={!matches || deleting}>
            {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('confirmDelete')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
