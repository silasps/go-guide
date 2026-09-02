'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { usePendingAction } from '@/hooks/use-pending-action'
import { formatCurrency, formatDate } from '@/lib/utils'
import { RecurringTransaction, FinancialAccount, TransactionCategory } from '@/types/database'
import { RecurringTransactionForm } from './recurring-transaction-form'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Pause, Play, Pencil, Trash2, Loader2 } from 'lucide-react'

interface Props {
  recurring: RecurringTransaction[]
  accounts: FinancialAccount[]
  categories: TransactionCategory[]
}

export function RecurringTransactionsList({ recurring, accounts, categories }: Props) {
  const router = useRouter()
  const { pendingValue: busyId, run } = usePendingAction<string>()
  const [editing, setEditing] = useState<RecurringTransaction | null>(null)

  function accountName(id: string) {
    return accounts.find(a => a.id === id)?.name ?? '—'
  }
  function categoryName(id: string | null) {
    return categories.find(c => c.id === id)?.name ?? null
  }

  function toggleActive(rt: RecurringTransaction) {
    run(rt.id, async () => {
      const supabase = createClient()
      const { error } = await supabase.from('recurring_transactions').update({ is_active: !rt.is_active }).eq('id', rt.id)
      if (error) { toast.error('Erro ao atualizar recorrência.'); return }
      toast.success(rt.is_active ? 'Recorrência pausada.' : 'Recorrência retomada.')
      router.refresh()
    })
  }

  function remove(rt: RecurringTransaction) {
    if (!confirm(`Excluir a recorrência "${rt.description}"?`)) return
    run(rt.id, async () => {
      const supabase = createClient()
      const { error } = await supabase.from('recurring_transactions').delete().eq('id', rt.id)
      if (error) { toast.error('Erro ao excluir recorrência.'); return }
      toast.success('Recorrência excluída.')
      router.refresh()
    })
  }

  if (recurring.length === 0) {
    return <p className="text-sm text-muted-foreground py-8 text-center">Nenhuma recorrência cadastrada — aluguel, assinaturas, mensalidades.</p>
  }

  return (
    <div className="space-y-2.5">
      {recurring.map((rt) => {
        const category = categoryName(rt.category_id)
        const isIncome = rt.type === 'income'
        return (
          <div key={rt.id} className="rounded-xl border bg-card p-3.5 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{rt.description}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {accountName(rt.account_id)}{category ? ` · ${category}` : ''} · Próxima: {formatDate(rt.next_due_date)}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`text-sm font-semibold ${isIncome ? 'text-green-600' : 'text-red-600'}`}>
                  {isIncome ? '+' : '-'}{formatCurrency(rt.amount, rt.currency)}
                </span>
                <Badge variant={rt.is_active ? 'success' : 'secondary'}>{rt.is_active ? 'Ativa' : 'Pausada'}</Badge>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => toggleActive(rt)} disabled={busyId === rt.id}>
                {busyId === rt.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : rt.is_active ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                {rt.is_active ? 'Pausar' : 'Retomar'}
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setEditing(rt)}>
                <Pencil className="h-3.5 w-3.5" /> Editar
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5 ml-auto" onClick={() => remove(rt)} disabled={busyId === rt.id}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )
      })}

      {editing && (
        <RecurringTransactionForm
          open={!!editing}
          onOpenChange={(v) => { if (!v) setEditing(null) }}
          recurring={editing}
          accounts={accounts}
          categories={categories}
        />
      )}
    </div>
  )
}
