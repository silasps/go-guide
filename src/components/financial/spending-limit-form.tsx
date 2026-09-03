'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { usePendingAction } from '@/hooks/use-pending-action'
import { TransactionCategory, SpendingLimit } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  limit?: SpendingLimit
  profileId: string
  categories: TransactionCategory[]
  currencies: string[]
  usedCategoryIds: string[]
  trigger?: React.ReactNode
}

function toMasked(raw: string) {
  const digits = raw.replace(/\D/g, '')
  if (!digits) return ''
  return (Number(digits) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })
}
function fromMasked(masked: string) {
  return masked.replace(/\./g, '').replace(',', '.')
}

// Um limite por categoria (UNIQUE no banco, ver migration 082) — o select
// já esconde categorias que já têm limite, exceto a própria ao editar.
export function SpendingLimitForm({ open, onOpenChange, limit, profileId, categories, currencies, usedCategoryIds, trigger }: Props) {
  const router = useRouter()
  const { isPending: saving, run } = usePendingAction()
  const topCategories = categories.filter((c) => !c.parent_id)
  const availableCategories = topCategories.filter((c) => c.id === limit?.category_id || !usedCategoryIds.includes(c.id))

  const [categoryId, setCategoryId] = useState(limit?.category_id ?? availableCategories[0]?.id ?? '')
  const [amount, setAmount] = useState(limit ? toMasked(String(Math.round(limit.limit_amount * 100))) : '')
  const [currency, setCurrency] = useState(limit?.currency ?? currencies[0] ?? 'BRL')

  function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const parsedAmount = parseFloat(fromMasked(amount))
    if (!parsedAmount || parsedAmount <= 0) { toast.error('Informe um valor válido.'); return }
    if (!categoryId) { toast.error('Selecione uma categoria.'); return }

    run(true, async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      const payload = { profile_id: profileId, category_id: categoryId, limit_amount: parsedAmount, currency }

      const { error } = limit
        ? await supabase.from('spending_limits').update(payload).eq('id', limit.id)
        : await supabase.from('spending_limits').insert({ ...payload, created_by_user_id: user!.id })

      if (error) { toast.error(error.code === '23505' ? 'Essa categoria já tem um limite.' : 'Erro ao salvar limite.'); return }
      toast.success(limit ? 'Limite atualizado.' : 'Limite criado.')
      onOpenChange(false)
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger}
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{limit ? 'Editar limite' : 'Novo limite de gastos'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="space-y-2">
            <Label>Categoria</Label>
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring" disabled={!!limit}>
              {availableCategories.length === 0 && <option value="">Nenhuma categoria disponível</option>}
              {availableCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Limite mensal</Label>
              <Input inputMode="numeric" value={amount} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAmount(toMasked(e.target.value))} placeholder="0,00" required />
            </div>
            {currencies.length > 1 && (
              <div className="space-y-2">
                <Label>Moeda</Label>
                <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring">
                  {currencies.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            )}
          </div>
          <p className="text-xs text-muted-foreground -mt-2">Compara com o total de despesas da categoria no mês corrente.</p>

          <div className="flex gap-2 pt-1">
            <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" className="flex-1" disabled={saving || (!limit && availableCategories.length === 0)}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {limit ? 'Salvar' : 'Criar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
