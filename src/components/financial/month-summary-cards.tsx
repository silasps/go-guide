'use client'

import { useEffect, useState } from 'react'
import { useMotionValue, useSpring } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils'
import { TimelinePoint } from '@/lib/financial/timeline'
import { HIDDEN_VALUE_MASK } from './month-navigator'
import { History, TrendingUp, TrendingDown, Wallet, Info } from 'lucide-react'

interface Props {
  point: TimelinePoint
  currency: string
  hideValues: boolean
}

function useCountUp(target: number) {
  const motionValue = useMotionValue(0)
  const spring = useSpring(motionValue, { stiffness: 90, damping: 20 })
  const [display, setDisplay] = useState(0)

  useEffect(() => { motionValue.set(target) }, [target, motionValue])
  useEffect(() => {
    const unsubscribe = spring.on('change', (v) => setDisplay(v))
    return unsubscribe
  }, [spring])

  return display
}

function monthBounds(month: string) {
  const [y, m] = month.split('-').map(Number)
  return { start: new Date(y, m - 1, 1), end: new Date(y, m, 0), prevEnd: new Date(y, m - 1, 0) }
}

const fmtDate = (d: Date) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })

// Cards de resumo do mês selecionado — Saldo Anterior/Receitas/Despesas/
// Saldo Disponível+Previsto, mesmo conceito do 4º card do GranaZen (ver
// 7.19). Substitui o antigo `BalanceSummary` (que só olhava o mês corrente
// e não tinha noção de pago/a pagar); esse componente foi removido.
export function MonthSummaryCards({ point, currency, hideValues }: Props) {
  const { end, prevEnd } = monthBounds(point.month)

  const saldoAnteriorDisplay = useCountUp(point.saldoAnterior)
  const incomeDisplay = useCountUp(point.income)
  const expenseDisplay = useCountUp(point.expense)
  const saldoDisponivelDisplay = useCountUp(point.saldoDisponivel)
  const saldoPrevistoDisplay = useCountUp(point.saldoPrevisto)

  const fmt = (v: number) => hideValues ? HIDDEN_VALUE_MASK : formatCurrency(v, currency)

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground flex items-center gap-1.5 font-normal">
            <History className="h-4 w-4" /> Saldo Anterior
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-0.5">
          <p className="text-lg font-semibold tabular-nums">{fmt(saldoAnteriorDisplay)}</p>
          <p className="text-xs text-muted-foreground">Até {fmtDate(prevEnd)}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground flex items-center gap-1.5 font-normal">
            <TrendingUp className="h-4 w-4 text-chart-1" /> Receitas
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5">
          <p className="text-lg font-semibold text-chart-1 tabular-nums">{fmt(incomeDisplay)}</p>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Recebido</span>
            <span className="tabular-nums">{fmt(point.incomeReceived)}</span>
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>A receber</span>
            <span className="tabular-nums">{fmt(point.incomePending)}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground flex items-center gap-1.5 font-normal">
            <TrendingDown className="h-4 w-4 text-chart-2" /> Despesas
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5">
          <p className="text-lg font-semibold text-chart-2 tabular-nums">{fmt(expenseDisplay)}</p>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Pago</span>
            <span className="tabular-nums">{fmt(point.expensePaid)}</span>
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Não pago</span>
            <span className="tabular-nums">{fmt(point.expenseUnpaid)}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6 space-y-3">
          <div className="space-y-0.5">
            <span className="text-sm text-muted-foreground flex items-center gap-1.5">
              <Wallet className="h-4 w-4" /> Saldo Disponível
            </span>
            <p className="text-lg font-semibold tabular-nums">{fmt(saldoDisponivelDisplay)}</p>
          </div>
          <div className="space-y-0.5 border-t pt-3">
            <span className="text-sm text-muted-foreground flex items-center gap-1.5" title="Saldo disponível + o que ainda falta receber e pagar até o fim do mês">
              <Info className="h-3.5 w-3.5" /> Saldo Previsto
            </span>
            <p className="text-lg font-semibold tabular-nums text-primary">{fmt(saldoPrevistoDisplay)}</p>
          </div>
          <p className="text-xs text-muted-foreground">Até {fmtDate(end)}</p>
        </CardContent>
      </Card>
    </div>
  )
}
