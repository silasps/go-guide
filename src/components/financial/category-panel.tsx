'use client'

import { useMemo, useState } from 'react'
import { CategoryBarChart } from '@/components/ui/charts/category-bar-chart'
import { aggregateByCategoryScoped, CategoryScope } from '@/lib/financial/dashboard-aggregation'
import { cn } from '@/lib/utils'
import { Transaction, TransactionCategory } from '@/types/database'

interface Props {
  transactions: Transaction[] // janela ampla, todos os meses/tipos
  categories: TransactionCategory[]
  month: string
  monthLabel: string
  currency: string
}

const SCOPES: { value: CategoryScope; label: string; heading: string; empty: (m: string) => string }[] = [
  { value: 'all', label: 'Todas', heading: 'Toda a movimentação', empty: (m) => `Nenhuma movimentação categorizada em ${m}.` },
  { value: 'income', label: 'Receitas', heading: 'Todas as receitas', empty: (m) => `Nenhuma receita categorizada em ${m}.` },
  { value: 'expense', label: 'Despesas', heading: 'Todas as despesas', empty: (m) => `Nenhuma despesa categorizada em ${m}.` },
  { value: 'expense_unpaid', label: 'Despesas Não Pagas', heading: 'Despesas não pagas', empty: (m) => `Nenhuma despesa pendente em ${m}.` },
]

function monthDateRangeLabel(month: string) {
  const [y, m] = month.split('-').map(Number)
  const start = new Date(y, m - 1, 1)
  const end = new Date(y, m, 0)
  const fmt = (d: Date) => d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })
  return `${fmt(start)} - ${fmt(end)}`
}

// Composição por categoria do mês selecionado, com o mesmo escopo do painel
// "Gráficos" do GranaZen (ver 7.20) — substitui o antigo card fixo "Por
// categoria" (só despesa), que virou redundante com este.
export function CategoryPanel({ transactions, categories, month, monthLabel, currency }: Props) {
  const [scope, setScope] = useState<CategoryScope>('expense')
  const data = useMemo(() => aggregateByCategoryScoped(transactions, categories, month, scope), [transactions, categories, month, scope])
  const activeScope = SCOPES.find((s) => s.value === scope)!

  return (
    <div className="space-y-3">
      <div className="flex rounded-lg border p-0.5 gap-0.5 overflow-x-auto scrollbar-hide">
        {SCOPES.map((s) => (
          <button
            key={s.value}
            type="button"
            onClick={() => setScope(s.value)}
            className={cn('px-2.5 py-1 rounded-md text-xs whitespace-nowrap transition-colors', scope === s.value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}
          >
            {s.label}
          </button>
        ))}
      </div>
      <div className="space-y-0.5">
        <h4 className="text-sm font-semibold">{activeScope.heading}</h4>
        <p className="text-xs text-muted-foreground capitalize">{monthDateRangeLabel(month)}</p>
      </div>
      <CategoryBarChart data={data} currency={currency} monthLabel={monthLabel} emptyLabel={activeScope.empty} />
    </div>
  )
}
