'use client'

import { useEffect, useRef } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
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
  hideValues: boolean
}

// Navegador de mês estilo GranaZen: abas trocam a métrica exibida em cada
// cartão da linha do tempo, sem recarregar nada — os pontos já vêm todos
// prontos de `buildFinancialTimeline` (ver 7.19), só troca qual campo lê.
// Meses futuros (depois do selecionado hoje) ganham borda tracejada — ainda
// não "aconteceram", só projeção; a linha que conecta os pontos segue o
// mesmo código: sólida colorida até o mês selecionado, tracejada depois.
export function MonthNavigator({ points, selectedMonth, onSelectMonth, metric, onMetricChange, currency, hideValues }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const selectedRef = useRef<HTMLButtonElement>(null)
  const selectedIndex = points.findIndex((p) => p.month === selectedMonth)
  const activeMetric = TIMELINE_METRICS.find((m) => m.value === metric)!

  useEffect(() => {
    selectedRef.current?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
  }, [selectedMonth])

  function shift(delta: number) {
    const next = points[selectedIndex + delta]
    if (next) onSelectMonth(next.month)
  }

  return (
    <Card className="border-border/70 shadow-none">
      <CardContent className="p-4 space-y-3">
        <div className="space-y-2 min-w-0">
          <div className="inline-flex items-center h-8 max-w-full overflow-x-auto scrollbar-hide rounded-lg bg-muted/60 p-1 text-muted-foreground">
            {TIMELINE_METRICS.map((m) => (
              <button
                key={m.value}
                type="button"
                onClick={() => onMetricChange(m.value)}
                className={cn(
                  'h-6 rounded-md px-2.5 text-xs font-medium whitespace-nowrap transition-all',
                  metric === m.value ? 'bg-background text-foreground shadow' : 'hover:text-foreground'
                )}
              >
                {m.label}
              </button>
            ))}
          </div>
          <p className="text-xs leading-5 text-muted-foreground max-w-2xl">{activeMetric.description}</p>
        </div>

        <div className="relative isolate overflow-hidden rounded-xl bg-muted/10 p-3">
          <div ref={scrollRef} className="flex gap-2 overflow-x-auto scrollbar-hide relative py-1">
            {points.map((p, i) => {
              const selected = p.month === selectedMonth
              const future = i > selectedIndex
              // Trecho de linha desenhado aqui liga o ponto i ao i+1 — só
              // conta como "futuro" (tracejado) a partir do próprio mês
              // selecionado em diante; o trecho que TERMINA nele continua
              // sólido (i < selectedIndex, não i <= ), senão a linha sólida
              // ultrapassa a bolinha selecionada rumo ao mês seguinte.
              const lineFuture = i >= selectedIndex
              const value = metricValue(p, metric)
              return (
                <div key={p.month} className="relative shrink-0" style={{ width: 144 }}>
                  {i < points.length - 1 && (
                    <div
                      aria-hidden
                      className={cn(
                        'pointer-events-none absolute top-[52px] left-1/2 h-0 w-[calc(100%+0.5rem)] border-t-2 z-0',
                        lineFuture ? 'border-dashed border-muted-foreground/30' : 'border-solid border-primary/60'
                      )}
                    />
                  )}
                  <button
                    ref={selected ? selectedRef : undefined}
                    type="button"
                    title={`${activeMetric.label} em ${p.monthLabel}: ${formatCurrency(value, currency)}`}
                    onClick={() => onSelectMonth(p.month)}
                    className={cn(
                      'relative z-10 flex w-full flex-col items-center rounded-lg border px-2 py-3 h-24 text-center transition-colors',
                      selected
                        ? 'border-primary bg-primary/10'
                        : future
                          ? 'border-dashed border-border bg-background/60 hover:bg-muted/20'
                          : 'border-border/70 bg-background/90 hover:bg-muted/20'
                    )}
                  >
                    {/* Alturas fixas (não justify-between) pra bolinha cair exatamente
                        em cima da linha (top-[52px] acima) — 12px padding + 32px dessa
                        linha + metade dos 16px da linha do meio = 52px do topo. */}
                    <span className="flex h-8 w-full items-center justify-center">
                      <span className={cn('truncate text-sm font-medium leading-tight', selected ? 'text-primary font-semibold' : 'text-muted-foreground')}>
                        {p.monthLabel}
                      </span>
                    </span>
                    <span className="flex h-4 w-full items-center justify-center">
                      <span className={cn('h-2.5 w-2.5 rounded-full shrink-0', selected ? 'bg-primary' : future ? 'bg-muted-foreground/30' : 'bg-primary/60')} />
                    </span>
                    <span className="flex flex-1 w-full items-center justify-center">
                      <span className={cn('truncate text-sm tabular-nums leading-tight', selected ? 'font-bold text-foreground' : 'font-semibold text-foreground')}>
                        {hideValues ? HIDDEN_VALUE_MASK : formatCurrency(value, currency)}
                      </span>
                    </span>
                  </button>
                </div>
              )
            })}
          </div>

          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full border-border/70 bg-background/85 shadow-none"
            onClick={() => shift(-1)}
            disabled={selectedIndex <= 0}
            aria-label="Mês anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full border-border/70 bg-background/85 shadow-none"
            onClick={() => shift(1)}
            disabled={selectedIndex === -1 || selectedIndex >= points.length - 1}
            aria-label="Próximo mês"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
