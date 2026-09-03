'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { usePendingAction } from '@/hooks/use-pending-action'
import { TransactionCategory } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { Check, Loader2 } from 'lucide-react'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  profileId: string
  category?: TransactionCategory
  parentId?: string | null
}

// Cor decorativa/organizacional (bolinha ao lado do nome na lista, ver
// CategoryTree) — deliberadamente independente da paleta categórica
// chart-3..8 que colore barras em CategoryBarChart/CategoryPanel (essas
// continuam coloridas por posição no ranking do mês, não por categoria
// fixa; sincronizar as duas coisas é um refactor maior, fora de escopo
// aqui). Por isso a lista de opções é mais ampla que os 6 slots de gráfico.
const COLOR_SWATCHES = [
  '#ff8800', '#ff5733', '#8330b9', '#33fff5', '#3357ff',
  '#33ff8c', '#ff3333', '#7d7d7d', '#e83e8c', '#1a9c7d',
]

export function CategoryForm({ open, onOpenChange, profileId, category, parentId }: Props) {
  const router = useRouter()
  const { isPending: saving, run } = usePendingAction()
  const [name, setName] = useState(category?.name ?? '')
  const [color, setColor] = useState(category?.color ?? COLOR_SWATCHES[0])

  function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!name.trim()) { toast.error('Dê um nome pra categoria.'); return }

    run(true, async () => {
      const supabase = createClient()
      const payload = { name: name.trim(), color }

      const { error } = category
        ? await supabase.from('transaction_categories').update(payload).eq('id', category.id)
        : await supabase.from('transaction_categories').insert({ ...payload, profile_id: profileId, parent_id: parentId ?? null })

      if (error) { toast.error('Erro ao salvar categoria.'); return }
      toast.success(category ? 'Categoria atualizada.' : 'Categoria criada.')
      onOpenChange(false)
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {category ? 'Editar categoria' : parentId ? 'Nova subcategoria' : 'Nova categoria'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="space-y-2">
            <Label>Nome *</Label>
            <Input value={name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)} placeholder="Ex: Transporte" autoFocus required />
          </div>

          <div className="space-y-2">
            <Label>Cor</Label>
            <div className="flex flex-wrap gap-2">
              {COLOR_SWATCHES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className="flex size-7 items-center justify-center rounded-full"
                  style={{ backgroundColor: c }}
                  aria-label={`Cor ${c}`}
                >
                  {color === c && <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" className="flex-1" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {category ? 'Salvar' : 'Criar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
