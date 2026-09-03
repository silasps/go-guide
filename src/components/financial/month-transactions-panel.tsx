'use client'

import { useMemo, useState } from 'react'
import { TransactionTable } from './transaction-table'
import { TransactionForm } from './transaction-form'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn, formatCurrency } from '@/lib/utils'
import { FinancialAccount, TransactionCategory, TransactionWithCategory, Partner } from '@/types/database'
import { Search, TrendingUp, TrendingDown } from 'lucide-react'

interface Props {
  transactions: TransactionWithCategory[] // janela ampla, todos os meses/tipos
  month: string
  monthLabel: string
  accounts: FinancialAccount[]
  categories: TransactionCategory[]
  partners: Partner[]
  highlights: { id: string; title: string; budgetCategories: { id: string; label: string }[] }[]
}

const TABS = [
  { value: 'all', label: 'Todas' },
  { value: 'income', label: 'Receitas' },
  { value: 'expense', label: 'Despesas' },
] as const

// Lançamentos do mês selecionado direto na Visão Geral (ver 7.20/7.22) —
// mesma `TransactionTable` de `/dashboard/financeiro/lancamentos` (edita,
// exclui, marca como pago), só escopada ao mês do `MonthNavigator` em vez
// de paginada por conta/categoria via query string. Botões de atalho
// Receita/Despesa abrem o mesmo `TransactionForm` já com o tipo pré-selecionado.
export function MonthTransactionsPanel({ transactions, month, monthLabel, accounts, categories, partners, highlights }: Props) {
  const [tab, setTab] = useState<(typeof TABS)[number]['value']>('all')
  const [search, setSearch] = useState('')
  const [quickAddType, setQuickAddType] = useState<'income' | 'expense' | null>(null)

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return transactions.filter((t) => {
      if (t.date.slice(0, 7) !== month) return false
      if (tab !== 'all' && t.type !== tab) return false
      if (term && !t.description.toLowerCase().includes(term) && !formatCurrency(t.amount, t.currency).toLowerCase().includes(term)) return false
      return true
    })
  }, [transactions, month, tab, search])

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex rounded-lg border p-0.5 gap-0.5">
          {TABS.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setTab(t.value)}
              className={cn('px-2.5 py-1 rounded-md text-xs transition-colors', tab === t.value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5 ml-auto">
          <Button type="button" size="sm" className="h-7 gap-1.5 bg-success text-success-foreground hover:bg-success/90" disabled={accounts.length === 0} onClick={() => setQuickAddType('income')}>
            <TrendingUp className="h-3.5 w-3.5" /> Receita
          </Button>
          <Button type="button" size="sm" className="h-7 gap-1.5 bg-destructive text-white hover:bg-destructive/90" disabled={accounts.length === 0} onClick={() => setQuickAddType('expense')}>
            <TrendingDown className="h-3.5 w-3.5" /> Despesa
          </Button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input value={search} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)} placeholder="Buscar por descrição ou valor..." className="h-8 pl-8 text-xs" />
      </div>

      <TransactionTable
        transactions={filtered}
        accounts={accounts}
        categories={categories}
        partners={partners}
        highlights={highlights}
        emptyTitle="Nenhuma transação encontrada"
        emptyHint={`Não há transações para exibir em ${monthLabel.toLowerCase()}.`}
      />

      {filtered.length > 0 && <p className="text-xs text-muted-foreground text-right">Total: {filtered.length}</p>}

      {quickAddType && (
        <TransactionForm
          open
          onOpenChange={(v) => !v && setQuickAddType(null)}
          defaultType={quickAddType}
          accounts={accounts}
          categories={categories}
          partners={partners}
          highlights={highlights}
        />
      )}
    </div>
  )
}
