'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft, ArrowRight, Calendar, Eye, EyeOff, RefreshCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { TimelinePoint } from '@/lib/financial/timeline'

interface Props {
  points: TimelinePoint[]
  selectedMonth: string
  onSelectMonth: (month: string) => void
  currentMonth: string
  monthLabel: string
  hideValues: boolean
  onToggleHideValues: () => void
}

function monthDateRangeLabel(month: string) {
  const [y, m] = month.split('-').map(Number)
  const start = new Date(y, m - 1, 1)
  const end = new Date(y, m, 0)
  const fmt = (d: Date) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  return `${fmt(start)} - ${fmt(end)}`
}

// Barra de período no topo da Visão Geral, pedida explicitamente pelo
// usuário depois de ver o HTML do GranaZen (ver 7.22). Reaproveita o mesmo
// `selectedMonth`/`timelinePoints` do `MonthNavigator` logo abaixo — os
// dois ficam sincronizados porque é o mesmo estado em `FinancialDashboard`.
// "Hoje"/"7 dias atrás"/"Esse ano" e o date-range picker editável do
// original ficaram de fora (não fazem sentido num dashboard organizado por
// mês, não por intervalo de dias arbitrário) — o intervalo aparece só como
// informação (mês inteiro selecionado), não como filtro editável.
export function PeriodFilterBar({ points, selectedMonth, onSelectMonth, currentMonth, monthLabel, hideValues, onToggleHideValues }: Props) {
  const router = useRouter()
  const selectedIndex = points.findIndex((p) => p.month === selectedMonth)

  function shift(delta: number) {
    const next = points[selectedIndex + delta]
    if (next) onSelectMonth(next.month)
  }

  return (
    <div className="flex items-center gap-2 flex-wrap rounded-xl border bg-background p-2">
      <div className="flex items-center gap-1">
        <Button type="button" variant="outline" size="icon-sm" onClick={() => shift(-1)} disabled={selectedIndex <= 0} aria-label="Período anterior">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <span className="min-w-[110px] text-center text-base font-bold capitalize">{monthLabel}</span>
        <Button type="button" variant="outline" size="icon-sm" onClick={() => shift(1)} disabled={selectedIndex === -1 || selectedIndex >= points.length - 1} aria-label="Próximo período">
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>

      <Button
        type="button"
        variant={selectedMonth === currentMonth ? 'default' : 'outline'}
        size="sm"
        className="h-9"
        onClick={() => onSelectMonth(currentMonth)}
      >
        Esse mês
      </Button>

      <div className={cn('hidden sm:flex items-center gap-1.5 h-9 rounded-md border px-3 text-sm text-muted-foreground')}>
        <Calendar className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{monthDateRangeLabel(selectedMonth)}</span>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <Button type="button" variant="outline" size="icon-sm" title={hideValues ? 'Mostrar valores' : 'Ocultar valores'} onClick={onToggleHideValues}>
          {hideValues ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </Button>
        <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => router.refresh()}>
          <RefreshCcw className="h-3.5 w-3.5" /> Atualizar
        </Button>
      </div>
    </div>
  )
}
