'use client'

import { useEffect, useState } from 'react'
import { useMotionValue, useSpring } from 'framer-motion'
import { formatCurrency, cn } from '@/lib/utils'
import { TimelinePoint } from '@/lib/financial/timeline'
import { HIDDEN_VALUE_MASK } from './month-navigator'
import { History, TrendingUp, TrendingDown, Wallet, Info, CircleCheck, Clock3 } from 'lucide-react'

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

const fmtDate = (d: Date) => d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })

const ACCENT = {
  primary: { bar: 'bg-primary', badge: 'bg-primary/10 text-primary', text: 'text-primary' },
  success: { bar: 'bg-success', badge: 'bg-success/10 text-success', text: 'text-success' },
  destructive: { bar: 'bg-destructive', badge: 'bg-destructive/10 text-destructive', text: 'text-destructive' },
} as const

function StatCard({ accent, icon, title, subtitle, value, children }: {
  accent: keyof typeof ACCENT
  icon: React.ReactNode
  title: string
  subtitle: string
  value: React.ReactNode
  children?: React.ReactNode
}) {
  const a = ACCENT[accent]
  return (
    <div className="relative overflow-hidden rounded-2xl border bg-background p-4 space-y-3">
      <span aria-hidden className={cn('absolute left-0 top-4 h-9 w-1 rounded-r-full', a.bar)} />
      <div className="flex min-w-0 items-center gap-2.5">
        <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-xl', a.badge)}>{icon}</span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{title}</p>
          <p className="truncate text-xs leading-5 text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      <p className={cn('truncate text-xl font-semibold', a.text)}>{value}</p>
      {children}
    </div>
  )
}

function SubRow({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: React.ReactNode; tone: 'success' | 'warning' }) {
  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-lg bg-muted/25 px-2.5 py-2">
      <div className="flex min-w-0 items-center gap-1.5">
        {icon}
        <span className="truncate text-xs font-medium leading-4 text-muted-foreground">{label}</span>
      </div>
      <p className={cn('shrink-0 truncate text-xs font-semibold leading-4', tone === 'success' ? 'text-success' : 'text-warning')}>{value}</p>
    </div>
  )
}

// Cards de resumo do mês selecionado — Saldo Anterior/Receitas/Despesas/
// Saldo Disponível+Previsto, mesmo conceito e paleta semântica (primary/
// success/destructive/warning) do GranaZen (ver 7.19/7.21).
export function MonthSummaryCards({ point, currency, hideValues }: Props) {
  const { end, prevEnd } = monthBounds(point.month)

  const saldoAnteriorDisplay = useCountUp(point.saldoAnterior)
  const incomeDisplay = useCountUp(point.income)
  const expenseDisplay = useCountUp(point.expense)
  const saldoDisponivelDisplay = useCountUp(point.saldoDisponivel)
  const saldoPrevistoDisplay = useCountUp(point.saldoPrevisto)

  const fmt = (v: number) => hideValues ? HIDDEN_VALUE_MASK : formatCurrency(v, currency)
  const checkIcon = <CircleCheck className="size-3.5 shrink-0 text-muted-foreground" />
  const clockIcon = <Clock3 className="size-3.5 shrink-0 text-muted-foreground" />

  return (
    <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        accent="primary"
        icon={<History className="size-4" />}
        title="Saldo Anterior"
        subtitle={`Até ${fmtDate(prevEnd)}`}
        value={fmt(saldoAnteriorDisplay)}
      />

      <StatCard
        accent="success"
        icon={<TrendingUp className="size-4" />}
        title="Receitas"
        subtitle={`${fmtDate(monthBounds(point.month).start)} - ${fmtDate(end)}`}
        value={fmt(incomeDisplay)}
      >
        <div className="grid grid-cols-1 gap-2">
          <SubRow icon={checkIcon} label="Recebido" value={fmt(point.incomeReceived)} tone="success" />
          <SubRow icon={clockIcon} label="A receber" value={fmt(point.incomePending)} tone="warning" />
        </div>
      </StatCard>

      <StatCard
        accent="destructive"
        icon={<TrendingDown className="size-4" />}
        title="Despesas"
        subtitle={`${fmtDate(monthBounds(point.month).start)} - ${fmtDate(end)}`}
        value={fmt(expenseDisplay)}
      >
        <div className="grid grid-cols-1 gap-2">
          <SubRow icon={checkIcon} label="Pago" value={fmt(point.expensePaid)} tone="success" />
          <SubRow icon={clockIcon} label="Não pago" value={fmt(point.expenseUnpaid)} tone="warning" />
        </div>
      </StatCard>

      <StatCard
        accent="primary"
        icon={<Wallet className="size-4" />}
        title="Saldo Disponível"
        subtitle={`Até ${fmtDate(end)}`}
        value={fmt(saldoDisponivelDisplay)}
      >
        <div className="grid grid-cols-1 gap-2">
          <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-lg bg-muted/25 px-2.5 py-2" title="Saldo disponível + o que ainda falta receber e pagar até o fim do mês">
            <div className="flex min-w-0 items-center gap-1.5">
              <Info className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate text-xs font-medium leading-4 text-muted-foreground">Saldo Previsto</span>
            </div>
            <p className="shrink-0 truncate text-xs font-bold leading-4 text-primary">{fmt(saldoPrevistoDisplay)}</p>
          </div>
        </div>
      </StatCard>
    </div>
  )
}
