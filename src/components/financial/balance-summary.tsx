'use client'

import { useEffect, useState } from 'react'
import { useMotionValue, useSpring } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils'
import { FinancialAccount, Transaction } from '@/types/database'
import { Wallet, TrendingUp, TrendingDown } from 'lucide-react'

interface Props {
  accounts: FinancialAccount[]
  monthTransactions: Transaction[]
}

// Conta de 0 até o valor final — sutil, só nos KPIs (não em cada número da
// tela, que seria ruído). Spring em vez de duração fixa: cresce mais rápido
// no começo e assenta suave no fim, sem parecer um contador mecânico.
function useCountUp(target: number) {
  const motionValue = useMotionValue(0)
  const spring = useSpring(motionValue, { stiffness: 90, damping: 20 })
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    motionValue.set(target)
  }, [target, motionValue])

  useEffect(() => {
    const unsubscribe = spring.on('change', (v) => setDisplay(v))
    return unsubscribe
  }, [spring])

  return display
}

export function BalanceSummary({ accounts, monthTransactions }: Props) {
  const byCurrency = new Map<string, number>()
  for (const acc of accounts) {
    byCurrency.set(acc.currency_code, (byCurrency.get(acc.currency_code) ?? 0) + acc.balance)
  }

  const income = monthTransactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const expense = monthTransactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
  const mainCurrency = accounts[0]?.currency_code ?? 'BRL'

  const incomeDisplay = useCountUp(income)
  const expenseDisplay = useCountUp(expense)

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground flex items-center gap-1.5 font-normal">
            <Wallet className="h-4 w-4" /> Saldo total
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-0.5">
          {byCurrency.size === 0 && <p className="text-lg font-semibold">{formatCurrency(0, mainCurrency)}</p>}
          {[...byCurrency.entries()].map(([currency, total]) => (
            <p key={currency} className="text-lg font-semibold">{formatCurrency(total, currency)}</p>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground flex items-center gap-1.5 font-normal">
            <TrendingUp className="h-4 w-4 text-chart-1" /> Entradas no mês
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-lg font-semibold text-chart-1 tabular-nums">{formatCurrency(incomeDisplay, mainCurrency)}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground flex items-center gap-1.5 font-normal">
            <TrendingDown className="h-4 w-4 text-chart-2" /> Saídas no mês
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-lg font-semibold text-chart-2 tabular-nums">{formatCurrency(expenseDisplay, mainCurrency)}</p>
        </CardContent>
      </Card>
    </div>
  )
}
