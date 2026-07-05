'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatDate } from '@/lib/utils'
import { FinancialAccount, TransactionCategory, TransactionWithCategory, Partner } from '@/types/database'
import { Button } from '@/components/ui/button'
import { TransactionForm } from './transaction-form'
import { toast } from 'sonner'
import { Pencil, Trash2, ArrowUpCircle, ArrowDownCircle, ArrowLeftRight, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface Props {
  transactions: TransactionWithCategory[]
  accounts: FinancialAccount[]
  categories?: TransactionCategory[]
  partners?: Partner[]
  highlights?: { id: string; title: string }[]
  readOnly?: boolean
}

const TYPE_ICON = {
  income: <ArrowUpCircle className="h-4 w-4 text-green-600 shrink-0" />,
  expense: <ArrowDownCircle className="h-4 w-4 text-red-600 shrink-0" />,
  transfer: <ArrowLeftRight className="h-4 w-4 text-muted-foreground shrink-0" />,
}

export function TransactionTable({ transactions, accounts, categories = [], partners = [], highlights = [], readOnly = false }: Props) {
  const router = useRouter()
  const [editing, setEditing] = useState<TransactionWithCategory | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function handleDelete(id: string) {
    if (!confirm('Excluir este lançamento? O saldo da conta será ajustado.')) return
    setDeletingId(id)
    const supabase = createClient()
    const { error } = await supabase.from('transactions').delete().eq('id', id)
    setDeletingId(null)
    if (error) { toast.error('Erro ao excluir lançamento.'); return }
    toast.success('Lançamento excluído.')
    router.refresh()
  }

  if (transactions.length === 0) {
    return <p className="text-sm text-muted-foreground py-8 text-center">Nenhum lançamento ainda.</p>
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
              </p>
            </div>
            <p className={`text-sm font-semibold shrink-0 ${t.type === 'income' ? 'text-green-600' : t.type === 'expense' ? 'text-red-600' : ''}`}>
              {t.type === 'expense' ? '-' : t.type === 'income' ? '+' : ''}{formatCurrency(t.amount, t.currency)}
            </p>
            {!readOnly && (
              <div className="flex items-center gap-0.5 shrink-0">
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
