'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { usePendingAction } from '@/hooks/use-pending-action'
import { formatCurrency, cn } from '@/lib/utils'
import { SpendingLimit, TransactionCategory } from '@/types/database'
import { SpendingLimitForm } from './spending-limit-form'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Pencil, Trash2, Loader2, AlertTriangle } from 'lucide-react'

interface Props {
  limits: SpendingLimit[]
  categories: TransactionCategory[]
  spentByCategory: Record<string, number>
  profileId: string
  currencies: string[]
}

export function SpendingLimitsList({ limits, categories, spentByCategory, profileId, currencies }: Props) {
  const router = useRouter()
  const { pendingValue: deletingId, run } = usePendingAction<string>()
  const [editing, setEditing] = useState<SpendingLimit | null>(null)

  function categoryName(id: string) {
    return categories.find((c) => c.id === id)?.name ?? 'Categoria removida'
  }

  function remove(limit: SpendingLimit) {
    if (!confirm(`Excluir o limite de "${categoryName(limit.category_id)}"?`)) return
    run(limit.id, async () => {
      const supabase = createClient()
      const { error } = await supabase.from('spending_limits').delete().eq('id', limit.id)
      if (error) { toast.error('Erro ao excluir limite.'); return }
      toast.success('Limite excluído.')
      router.refresh()
    })
  }

  if (limits.length === 0) {
    return <p className="text-sm text-muted-foreground py-8 text-center">Nenhum limite de gastos cadastrado.</p>
  }

  return (
    <div className="space-y-2.5">
      {limits.map((limit) => {
        const spent = spentByCategory[limit.category_id] ?? 0
        const pct = limit.limit_amount > 0 ? Math.min(100, (spent / limit.limit_amount) * 100) : 0
        const overLimit = spent > limit.limit_amount
        return (
          <div key={limit.id} className="rounded-xl border bg-card p-3.5 space-y-2.5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-medium truncate flex items-center gap-1.5">
                  {overLimit && <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />}
                  {categoryName(limit.category_id)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatCurrency(spent, limit.currency)} de {formatCurrency(limit.limit_amount, limit.currency)}
                </p>
              </div>
              <span className={cn('text-sm font-semibold shrink-0', overLimit ? 'text-destructive' : 'text-muted-foreground')}>
                {Math.round(pct)}%
              </span>
            </div>
            <Progress value={pct} className={cn('h-1.5', overLimit && '[&_[data-slot=progress-indicator]]:bg-destructive')} />
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setEditing(limit)}>
                <Pencil className="h-3.5 w-3.5" /> Editar
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5 ml-auto" onClick={() => remove(limit)} disabled={deletingId === limit.id}>
                {deletingId === limit.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              </Button>
            </div>
          </div>
        )
      })}

      {editing && (
        <SpendingLimitForm
          open
          onOpenChange={(v) => !v && setEditing(null)}
          limit={editing}
          profileId={profileId}
          categories={categories}
          currencies={currencies}
          usedCategoryIds={limits.map((l) => l.category_id)}
        />
      )}
    </div>
  )
}
