'use client'

import { useMemo, useState } from 'react'
import { TransactionTable } from './transaction-table'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { FinancialAccount, TransactionCategory, TransactionWithCategory, Partner } from '@/types/database'
import { Search } from 'lucide-react'

interface Props {
  transactions: TransactionWithCategory[] // janela ampla, todos os meses/tipos
  month: string
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

// Lançamentos do mês selecionado direto na Visão Geral (ver 7.20) — mesma
// `TransactionTable` de `/dashboard/financeiro/lancamentos` (edita, exclui,
// marca como pago), só escopada ao mês do `MonthNavigator` em vez de
// paginada por conta/categoria via query string.
export function MonthTransactionsPanel({ transactions, month, accounts, categories, partners, highlights }: Props) {
  const [tab, setTab] = useState<(typeof TABS)[number]['value']>('all')
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return transactions.filter((t) => {
      if (t.date.slice(0, 7) !== month) return false
      if (tab !== 'all' && t.type !== tab) return false
      if (term && !t.description.toLowerCase().includes(term)) return false
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
        <div className="relative flex-1 min-w-[140px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input value={search} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)} placeholder="Buscar por descrição..." className="h-7 pl-8 text-xs" />
        </div>
      </div>

      <TransactionTable transactions={filtered} accounts={accounts} categories={categories} partners={partners} highlights={highlights} />
    </div>
  )
}
