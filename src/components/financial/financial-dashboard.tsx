'use client'

import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { MonthSummaryCards } from './month-summary-cards'
import { MonthNavigator } from './month-navigator'
import { PeriodFilterBar } from './period-filter-bar'
import { MonthTransactionsPanel } from './month-transactions-panel'
import { CategoryPanel } from './category-panel'
import { TrendChart } from '@/components/ui/charts/trend-chart'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { aggregateMonthly } from '@/lib/financial/dashboard-aggregation'
import { buildFinancialTimeline, TimelineMetric } from '@/lib/financial/timeline'
import { FinancialAccount, TransactionWithCategory, TransactionCategory, Partner } from '@/types/database'
import { cn } from '@/lib/utils'

interface Props {
  accounts: FinancialAccount[]
  transactions: TransactionWithCategory[] // janela ampla, todos os tipos
  categories: TransactionCategory[]
  partners: Partner[]
  highlights: { id: string; title: string; budgetCategories: { id: string; label: string }[] }[]
}

const RANGE_OPTIONS = [
  { value: 3, label: '3 meses' },
  { value: 6, label: '6 meses' },
  { value: 12, label: '12 meses' },
] as const

function currentMonthStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0 },
}

// Container "cérebro" da Visão Geral: dono do filtro de período/moeda que
// escopa tudo abaixo (dataviz skill — "filters scope everything below
// them"), e da seleção de mês que conecta os dois gráficos (clicar num mês
// do fluxo de caixa re-escopa a composição por categoria).
export function FinancialDashboard({ accounts, transactions, categories, partners, highlights }: Props) {
  // Arquivada (ver 7.29) = fora de qualquer total/composição nova, mas
  // `accounts` (completo) continua descendo pro `MonthTransactionsPanel` —
  // a tabela de lançamentos ali precisa achar a conta de transações antigas
  // mesmo já arquivada; só o "novo lançamento" ali dentro usa só as ativas.
  const activeAccounts = useMemo(() => accounts.filter((a) => !a.archived), [accounts])
  const currencies = useMemo(() => [...new Set(activeAccounts.map((a) => a.currency_code))], [activeAccounts])
  const [currency, setCurrency] = useState(currencies[0] ?? 'BRL')
  const [monthsRange, setMonthsRange] = useState<3 | 6 | 12>(6)
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthStr())
  const [timelineMetric, setTimelineMetric] = useState<TimelineMetric>('saldo_previsto')
  const [hideValues, setHideValues] = useState(false)

  const txInCurrency = useMemo(() => transactions.filter((t) => t.currency === currency), [transactions, currency])
  const monthlyData = useMemo(() => aggregateMonthly(txInCurrency, monthsRange), [txInCurrency, monthsRange])

  const currentBalance = useMemo(
    () => activeAccounts.filter((a) => a.currency_code === currency).reduce((s, a) => s + a.balance, 0),
    [activeAccounts, currency]
  )
  const timelinePoints = useMemo(() => buildFinancialTimeline(txInCurrency, currentBalance, 6, 6), [txInCurrency, currentBalance])
  const selectedPoint = timelinePoints.find((p) => p.month === selectedMonth) ?? timelinePoints[6]

  const selectedMonthLabel = selectedPoint?.monthLabel ?? selectedMonth

  return (
    <motion.div className="space-y-6" initial="hidden" animate="show" transition={{ staggerChildren: 0.08 }}>
      <motion.div variants={fadeUp}>
        <PeriodFilterBar
          points={timelinePoints}
          selectedMonth={selectedMonth}
          onSelectMonth={setSelectedMonth}
          currentMonth={currentMonthStr()}
          monthLabel={selectedMonthLabel}
          hideValues={hideValues}
          onToggleHideValues={() => setHideValues((v) => !v)}
        />
      </motion.div>

      <motion.div variants={fadeUp}>
        <MonthNavigator
          points={timelinePoints}
          selectedMonth={selectedMonth}
          onSelectMonth={setSelectedMonth}
          metric={timelineMetric}
          onMetricChange={setTimelineMetric}
          currency={currency}
          hideValues={hideValues}
        />
      </motion.div>

      <motion.div variants={fadeUp}>
        <MonthSummaryCards point={selectedPoint} currency={currency} hideValues={hideValues} />
      </motion.div>

      <motion.div variants={fadeUp} className="flex items-center gap-2 flex-wrap">
        <div className="flex rounded-lg border p-0.5 gap-0.5">
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setMonthsRange(opt.value)}
              className={cn('px-2.5 py-1 rounded-md text-xs transition-colors', monthsRange === opt.value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {currencies.length > 1 && (
          <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="h-7 rounded-lg border border-input bg-transparent px-2 text-xs outline-none">
            {currencies.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
      </motion.div>

      <motion.div variants={fadeUp}>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Fluxo de caixa</CardTitle>
          </CardHeader>
          <CardContent>
            <TrendChart data={monthlyData} currency={currency} selectedMonth={selectedMonth} onSelectMonth={setSelectedMonth} />
          </CardContent>
        </Card>
      </motion.div>

      <motion.div variants={fadeUp} className="grid gap-4 lg:grid-cols-2 items-start">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Lançamentos — {selectedMonthLabel}</CardTitle>
          </CardHeader>
          <CardContent>
            <MonthTransactionsPanel transactions={txInCurrency} month={selectedMonth} monthLabel={selectedMonthLabel} accounts={accounts} categories={categories} partners={partners} highlights={highlights} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Gráficos</CardTitle>
          </CardHeader>
          <CardContent>
            <CategoryPanel transactions={txInCurrency} categories={categories} month={selectedMonth} monthLabel={selectedMonthLabel} currency={currency} />
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  )
}
