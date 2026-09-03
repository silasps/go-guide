'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { usePendingAction } from '@/hooks/use-pending-action'
import { formatCurrency, formatDate } from '@/lib/utils'
import { FinancialAccount, TransactionCategory, TransactionWithCategory, Partner } from '@/types/database'
import { Button } from '@/components/ui/button'
import { TransactionForm } from './transaction-form'
import { toast } from 'sonner'
import { Pencil, Trash2, ArrowUpCircle, ArrowDownCircle, ArrowLeftRight, Loader2, CheckCircle2, FileText } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface Props {
  transactions: TransactionWithCategory[]
  accounts: FinancialAccount[]
  categories?: TransactionCategory[]
  partners?: Partner[]
  highlights?: { id: string; title: string; budgetCategories: { id: string; label: string }[] }[]
  readOnly?: boolean
  emptyTitle?: string
  emptyHint?: string
}

const TYPE_ICON = {
  income: <ArrowUpCircle className="h-4 w-4 text-green-600 shrink-0" />,
  expense: <ArrowDownCircle className="h-4 w-4 text-red-600 shrink-0" />,
  transfer: <ArrowLeftRight className="h-4 w-4 text-muted-foreground shrink-0" />,
}

export function TransactionTable({ transactions, accounts, categories = [], partners = [], highlights = [], readOnly = false, emptyTitle = 'Nenhum lançamento ainda.', emptyHint }: Props) {
  const router = useRouter()
  const [editing, setEditing] = useState<TransactionWithCategory | null>(null)
  const { pendingValue: deletingId, run } = usePendingAction<string>()
  const { pendingValue: markingPaidId, run: runMarkPaid } = usePendingAction<string>()

  function handleDelete(id: string) {
    if (!confirm('Excluir este lançamento? O saldo da conta será ajustado.')) return
    run(id, async () => {
      const supabase = createClient()
      const { error } = await supabase.from('transactions').delete().eq('id', id)
      if (error) { toast.error('Erro ao excluir lançamento.'); return }
      toast.success('Lançamento excluído.')
      router.refresh()
    })
  }

  function handleMarkPaid(t: TransactionWithCategory) {
    runMarkPaid(t.id, async () => {
      const supabase = createClient()
      const { error } = await supabase.from('transactions').update({ is_paid: true }).eq('id', t.id)
      if (error) { toast.error('Erro ao atualizar lançamento.'); return }
      toast.success(t.type === 'income' ? 'Marcado como recebido.' : 'Marcado como pago.')
      router.refresh()
    })
  }

  if (transactions.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-12 text-center">
        <FileText className="h-8 w-8 text-muted-foreground/50" />
        <p className="text-sm font-medium">{emptyTitle}</p>
        {emptyHint && <p className="text-xs text-muted-foreground">{emptyHint}</p>}
      </div>
    )
  }

  return (
    <>
      <div className="rounded-xl border divide-y bg-card">
        {transactions.map(t => (
          <div key={t.id} className="flex items-center gap-3 p-3">
            {TYPE_ICON[t.type]}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">{t.description}</p>
              <p className="text-xs text-muted-foreground truncate">
                {formatDate(t.date)}
                {t.category?.name && ` · ${t.category.name}`}
                {t.partner?.name && ` · ${t.partner.name}`}
                {!t.is_paid && <span className="text-amber-600"> · {t.type === 'income' ? 'A receber' : 'Não pago'}</span>}
              </p>
            </div>
            <p className={`text-sm font-semibold shrink-0 ${!t.is_paid ? 'opacity-50' : ''} ${t.type === 'income' ? 'text-green-600' : t.type === 'expense' ? 'text-red-600' : ''}`}>
              {t.type === 'expense' ? '-' : t.type === 'income' ? '+' : ''}{formatCurrency(t.amount, t.currency)}
            </p>
            {!readOnly && (
              <div className="flex items-center gap-0.5 shrink-0">
                {!t.is_paid && (
                  <Button variant="ghost" size="icon-sm" title={t.type === 'income' ? 'Marcar como recebido' : 'Marcar como pago'} onClick={() => handleMarkPaid(t)} disabled={markingPaidId === t.id}>
                    {markingPaidId === t.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5 text-chart-1" />}
                  </Button>
                )}
                <Button variant="ghost" size="icon-sm" onClick={() => setEditing(t)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon-sm" onClick={() => handleDelete(t.id)} disabled={deletingId === t.id}>
                  {deletingId === t.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>

      {editing && (
        <TransactionForm
          open
          onOpenChange={(v) => !v && setEditing(null)}
          transaction={editing}
          accounts={accounts}
          categories={categories}
          partners={partners}
          highlights={highlights}
        />
      )}
    </>
  )
}
