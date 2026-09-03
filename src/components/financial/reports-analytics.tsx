'use client'

import { useMemo, useState } from 'react'
import { PeriodFilterBar } from './period-filter-bar'
import { CategoryBarChart } from '@/components/ui/charts/category-bar-chart'
import { FrequencyChart } from '@/components/ui/charts/frequency-chart'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { aggregateByCategoryScoped, aggregateFrequency, FrequencyGrouping } from '@/lib/financial/dashboard-aggregation'
import { buildFinancialTimeline } from '@/lib/financial/timeline'
import { FinancialAccount, Transaction, TransactionCategory } from '@/types/database'
import { cn } from '@/lib/utils'
import { TrendingUp } from 'lucide-react'

interface Props {
  accounts: FinancialAccount[]
  transactions: Transaction[] // janela ampla, todos os tipos
  categories: TransactionCategory[]
}

function currentMonthStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function monthDateRangeLabel(month: string) {
  const [y, m] = month.split('-').map(Number)
  const start = new Date(y, m - 1, 1)
  const end = new Date(y, m, 0)
  const fmt = (d: Date) => d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })
  return `${fmt(start)} - ${fmt(end)}`
}

const GROUPING_OPTIONS: { value: FrequencyGrouping; label: string }[] = [
  { value: 'daily', label: 'Diário' },
  { value: 'weekly', label: 'Semanal' },
]

// Aba "Relatórios" (analytics) estilo GranaZen (ver 7.24) — Despesas/Receitas
// por Categoria reaproveitam o mesmo `CategoryBarChart`/`aggregateByCategoryScoped`
// já usados no painel "Gráficos" da Visão Geral (7.21); a novidade aqui é o
// `FrequencyChart` (Receitas x Despesas por dia/semana dentro do mês), que
// não existia. Mesma `PeriodFilterBar` do topo da Visão Geral, com seu
// próprio estado de mês/moeda — intencionalmente independente, não
// compartilha seleção com a Visão Geral (páginas diferentes).
export function ReportsAnalytics({ accounts, transactions, categories }: Props) {
  const currencies = useMemo(() => [...new Set(accounts.map((a) => a.currency_code))], [accounts])
  const [currency, setCurrency] = useState(currencies[0] ?? 'BRL')
  const [selectedMonth, setSelectedMonth] = useState(currentMonthStr())
  const [hideValues, setHideValues] = useState(false)
  const [grouping, setGrouping] = useState<FrequencyGrouping>('daily')

  const txInCurrency = useMemo(() => transactions.filter((t) => t.currency === currency), [transactions, currency])

  const currentBalance = useMemo(
    () => accounts.filter((a) => a.currency_code === currency).reduce((s, a) => s + a.balance, 0),
    [accounts, currency]
  )
  const timelinePoints = useMemo(() => buildFinancialTimeline(txInCurrency, currentBalance, 6, 6), [txInCurrency, currentBalance])
  const selectedPoint = timelinePoints.find((p) => p.month === selectedMonth) ?? timelinePoints[6]
  const selectedMonthLabel = selectedPoint?.monthLabel ?? selectedMonth
  const dateRangeLabel = monthDateRangeLabel(selectedMonth)

  const expenseData = useMemo(() => aggregateByCategoryScoped(txInCurrency, categories, selectedMonth, 'expense'), [txInCurrency, categories, selectedMonth])
  const incomeData = useMemo(() => aggregateByCategoryScoped(txInCurrency, categories, selectedMonth, 'income'), [txInCurrency, categories, selectedMonth])
  const frequencyData = useMemo(() => aggregateFrequency(txInCurrency, selectedMonth, grouping), [txInCurrency, selectedMonth, grouping])

  return (
    <div className="space-y-4">
      <PeriodFilterBar
        points={timelinePoints}
        selectedMonth={selectedMonth}
        onSelectMonth={setSelectedMonth}
        currentMonth={currentMonthStr()}
        monthLabel={selectedMonthLabel}
        hideValues={hideValues}
        onToggleHideValues={() => setHideValues((v) => !v)}
      />

      {currencies.length > 1 && (
        <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="h-7 rounded-lg border border-input bg-transparent px-2 text-xs outline-none">
          {currencies.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Despesas por categoria</CardTitle>
            <p className="text-xs text-muted-foreground capitalize">{dateRangeLabel}</p>
          </CardHeader>
          <CardContent>
            <CategoryBarChart data={expenseData} currency={currency} monthLabel={selectedMonthLabel} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Receitas por categoria</CardTitle>
            <p className="text-xs text-muted-foreground capitalize">{dateRangeLabel}</p>
          </CardHeader>
          <CardContent>
            <CategoryBarChart data={incomeData} currency={currency} monthLabel={selectedMonthLabel} emptyLabel={(m) => `Nenhuma receita categorizada em ${m}.`} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2 flex flex-row items-start justify-between gap-3 flex-wrap space-y-0">
          <div className="space-y-0.5">
            <CardTitle className="text-sm font-medium flex items-center gap-1.5">
              <TrendingUp className="h-4 w-4 text-primary" /> Gráficos de frequência — Receitas x Despesas
            </CardTitle>
            <p className="text-xs text-muted-foreground">Visualize a frequência de receitas e despesas ao longo do mês</p>
          </div>
          <div className="flex rounded-lg border p-0.5 gap-0.5 shrink-0">
            {GROUPING_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setGrouping(opt.value)}
                className={cn('px-2.5 py-1 rounded-md text-xs transition-colors', grouping === opt.value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          <FrequencyChart data={frequencyData} currency={currency} />
        </CardContent>
      </Card>
    </div>
  )
}
