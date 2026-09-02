'use client'

import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { BalanceSummary } from './balance-summary'
import { TrendChart } from '@/components/ui/charts/trend-chart'
import { CategoryBarChart } from '@/components/ui/charts/category-bar-chart'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { aggregateMonthly, aggregateByCategory } from '@/lib/financial/dashboard-aggregation'
import { FinancialAccount, Transaction, TransactionCategory } from '@/types/database'
import { cn } from '@/lib/utils'

interface Props {
  accounts: FinancialAccount[]
  transactions: Transaction[] // últimos 12 meses, todos os tipos
  categories: TransactionCategory[]
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
export function FinancialDashboard({ accounts, transactions, categories }: Props) {
  const currencies = useMemo(() => [...new Set(accounts.map((a) => a.currency_code))], [accounts])
  const [currency, setCurrency] = useState(currencies[0] ?? 'BRL')
  const [monthsRange, setMonthsRange] = useState<3 | 6 | 12>(6)
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthStr())

  const txInCurrency = useMemo(() => transactions.filter((t) => t.currency === currency), [transactions, currency])
  const monthlyData = useMemo(() => aggregateMonthly(txInCurrency, monthsRange), [txInCurrency, monthsRange])
  const categoryData = useMemo(() => aggregateByCategory(txInCurrency, categories, selectedMonth), [txInCurrency, categories, selectedMonth])

  const monthTransactionsForSummary = useMemo(() => {
    const now = currentMonthStr()
    return transactions.filter((t) => t.date.slice(0, 7) === now)
  }, [transactions])

  const selectedMonthLabel = monthlyData.find((p) => p.month === selectedMonth)?.monthLabel ?? selectedMonth

  return (
    <motion.div className="space-y-6" initial="hidden" animate="show" transition={{ staggerChildren: 0.08 }}>
      <motion.div variants={fadeUp}>
        <BalanceSummary accounts={accounts} monthTransactions={monthTransactionsForSummary} />
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

      <motion.div variants={fadeUp}>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Por categoria — {selectedMonthLabel}</CardTitle>
          </CardHeader>
          <CardContent>
            <CategoryBarChart data={categoryData} currency={currency} monthLabel={selectedMonthLabel} />
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  )
}
