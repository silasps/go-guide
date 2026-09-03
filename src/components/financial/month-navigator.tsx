'use client'

import { useEffect, useRef } from 'react'
import { ChevronLeft, ChevronRight, Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatCurrency, cn } from '@/lib/utils'
import { TimelinePoint, TimelineMetric, TIMELINE_METRICS, metricValue } from '@/lib/financial/timeline'

export const HIDDEN_VALUE_MASK = '••••'

interface Props {
  points: TimelinePoint[]
  selectedMonth: string
  onSelectMonth: (month: string) => void
  metric: TimelineMetric
  onMetricChange: (metric: TimelineMetric) => void
  currency: string
  currentMonth: string
  hideValues: boolean
  onToggleHideValues: () => void
}

// Navegador de mês estilo GranaZen: abas trocam a métrica exibida em cada
// cartão da linha do tempo, sem recarregar nada — os pontos já vêm todos
// prontos de `buildFinancialTimeline` (ver 7.19), só troca qual campo lê.
export function MonthNavigator({ points, selectedMonth, onSelectMonth, metric, onMetricChange, currency, currentMonth, hideValues, onToggleHideValues }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const selectedRef = useRef<HTMLButtonElement>(null)
  const selectedIndex = points.findIndex((p) => p.month === selectedMonth)

  useEffect(() => {
    selectedRef.current?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
  }, [selectedMonth])

  function shift(delta: number) {
    const next = points[selectedIndex + delta]
    if (next) onSelectMonth(next.month)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex rounded-lg border p-0.5 gap-0.5 overflow-x-auto scrollbar-hide">
          {TIMELINE_METRICS.map((m) => (
            <button
              key={m.value}
              type="button"
              onClick={() => onMetricChange(m.value)}
              className={cn(
                'px-2.5 py-1 rounded-md text-xs whitespace-nowrap transition-colors',
                metric === m.value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
        {selectedMonth !== currentMonth && (
          <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => onSelectMonth(currentMonth)}>
            Mês atual
          </Button>
        )}
        <Button type="button" variant="ghost" size="icon-sm" className="ml-auto" title={hideValues ? 'Mostrar valores' : 'Ocultar valores'} onClick={onToggleHideValues}>
          {hideValues ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </Button>
      </div>

      <div className="flex items-center gap-1">
        <Button type="button" variant="ghost" size="icon-sm" className="shrink-0" onClick={() => shift(-1)} disabled={selectedIndex <= 0}>
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <div className="relative flex-1 overflow-hidden">
          <div className="pointer-events-none absolute left-0 right-0 top-[38px] h-px bg-border" />
          <div ref={scrollRef} className="flex gap-1 overflow-x-auto scrollbar-hide relative py-1">
            {points.map((p) => {
              const selected = p.month === selectedMonth
              return (
                <button
                  key={p.month}
                  ref={selected ? selectedRef : undefined}
                  type="button"
                  onClick={() => onSelectMonth(p.month)}
                  className={cn(
                    'flex flex-col items-center gap-2 shrink-0 w-28 rounded-lg border px-2 py-2.5 transition-colors',
                    selected ? 'border-primary bg-primary/5' : 'border-transparent hover:bg-muted/50'
                  )}
                >
                  <span className={cn('text-xs font-medium truncate max-w-full', selected ? 'text-primary' : 'text-muted-foreground')}>
                    {p.monthLabel}
                  </span>
                  <span className={cn('h-2.5 w-2.5 rounded-full shrink-0', selected ? 'bg-primary' : 'bg-border')} />
                  <span className="text-sm font-semibold tabular-nums">{hideValues ? HIDDEN_VALUE_MASK : formatCurrency(metricValue(p, metric), currency)}</span>
                </button>
              )
            })}
          </div>
        </div>

        <Button type="button" variant="ghost" size="icon-sm" className="shrink-0" onClick={() => shift(1)} disabled={selectedIndex === -1 || selectedIndex >= points.length - 1}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
