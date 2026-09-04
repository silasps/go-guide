'use client'

import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { formatCurrency } from '@/lib/utils'
import { FrequencyBucket } from '@/lib/financial/dashboard-aggregation'
import { Table2, BarChart3 } from 'lucide-react'

interface Props {
  data: FrequencyBucket[]
  currency: string
}

const VIEW_W = 600
const VIEW_H = 220
const PAD_TOP = 16
const PAD_BOTTOM = 28
const PAD_LEFT = 44
const PAD_RIGHT = 8
const PLOT_W = VIEW_W - PAD_LEFT - PAD_RIGHT
const PLOT_H = VIEW_H - PAD_TOP - PAD_BOTTOM

function formatCompact(amount: number, currency: string) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency, notation: 'compact', maximumFractionDigits: 1 }).format(amount)
}

function niceMax(value: number) {
  if (value <= 0) return 100
  const magnitude = 10 ** Math.floor(Math.log10(value))
  const normalized = value / magnitude
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10
  return step * magnitude
}

// Receitas x Despesas por dia/semana dentro do mês (dataviz skill: 2 séries,
// magnitude por período -> par de colunas, cor categórica chart-1/chart-2 —
// mesma paleta e papel do TrendChart, não repete verde/vermelho do
// GranaZen: aqui já é usado pra status, não série). Hover é por par de
// colunas (bar/cell, não crosshair — regra da skill), toggle de tabela =
// par de acessibilidade.
export function FrequencyChart({ data, currency }: Props) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)
  const [showTable, setShowTable] = useState(false)

  const maxValue = useMemo(() => niceMax(Math.max(...data.map((d) => Math.max(d.income, d.expense)), 0)), [data])
  const hasData = data.some((d) => d.income > 0 || d.expense > 0)

  const n = data.length
  const groupWidth = PLOT_W / n
  const barWidth = Math.max(1.5, groupWidth * 0.32)
  const baseline = PAD_TOP + PLOT_H

  function xForGroup(i: number) {
    return PAD_LEFT + i * groupWidth + groupWidth / 2
  }
  function yFor(v: number) {
    return PAD_TOP + (1 - v / maxValue) * PLOT_H
  }

  const labelStride = Math.max(1, Math.ceil(n / 8))
  const shownIndices = new Set<number>()
  for (let i = 0; i < n; i += labelStride) shownIndices.add(i)
  shownIndices.add(n - 1)
  // Se o stride deixou o penúltimo grudado no último forçado, tira o
  // penúltimo — senão os dois rótulos colidem (mesma correção do TrendChart).
  if (shownIndices.has(n - 2) && shownIndices.has(n - 1)) shownIndices.delete(n - 2)

  const gridLines = [0, 0.5, 1]

  if (!hasData) {
    return (
      <div className="flex flex-col items-center gap-2 py-12 text-center">
        <BarChart3 className="h-8 w-8 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">Nenhum lançamento no período pra mostrar esse gráfico.</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 text-xs">
          <span className="inline-flex items-center gap-1.5"><span className="inline-block w-2.5 h-2.5 rounded-[2px] bg-chart-1" />Receitas</span>
          <span className="inline-flex items-center gap-1.5"><span className="inline-block w-2.5 h-2.5 rounded-[2px] bg-chart-2" />Despesas</span>
        </div>
        <button type="button" onClick={() => setShowTable((v) => !v)} className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
          {showTable ? <BarChart3 className="h-3.5 w-3.5" /> : <Table2 className="h-3.5 w-3.5" />}
          {showTable ? 'Ver gráfico' : 'Ver como tabela'}
        </button>
      </div>

      {showTable ? (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-muted-foreground border-b">
                <th className="py-1.5 pr-3 font-medium">Período</th>
                <th className="py-1.5 pr-3 font-medium">Receitas</th>
                <th className="py-1.5 font-medium">Despesas</th>
              </tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.key} className="border-b border-border/50 last:border-0">
                  <td className="py-1.5 pr-3">{d.label}</td>
                  <td className="py-1.5 pr-3">{formatCurrency(d.income, currency)}</td>
                  <td className="py-1.5">{formatCurrency(d.expense, currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="relative">
          <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className="w-full h-auto" role="img" aria-label="Receitas e despesas por período">
            {gridLines.map((g) => {
              const y = PAD_TOP + g * PLOT_H
              return (
                <g key={g}>
                  <line x1={PAD_LEFT} x2={VIEW_W - PAD_RIGHT} y1={y} y2={y} stroke="var(--border)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
                  <text x={PAD_LEFT - 6} y={y + 3} textAnchor="end" fontSize={9} fill="var(--muted-foreground)">
                    {formatCompact(maxValue * (1 - g), currency)}
                  </text>
                </g>
              )
            })}

            {data.map((d, i) => {
              if (!shownIndices.has(i)) return null
              const anchor = i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'
              return (
                <text key={d.key} x={xForGroup(i)} y={VIEW_H - 8} textAnchor={anchor} fontSize={9} fill="var(--muted-foreground)">
                  {d.label}
                </text>
              )
            })}

            {data.map((d, i) => {
              const cx = xForGroup(i)
              const incomeH = baseline - yFor(d.income)
              const expenseH = baseline - yFor(d.expense)
              const hovered = hoverIndex === i
              return (
                <g key={d.key} opacity={hoverIndex !== null && !hovered ? 0.55 : 1}>
                  <motion.rect
                    x={cx - barWidth - 1} width={barWidth} rx={2}
                    fill="var(--chart-1)"
                    initial={{ y: baseline, height: 0 }}
                    animate={{ y: baseline - incomeH, height: incomeH }}
                    transition={{ duration: 0.5, delay: i * 0.008 }}
                  />
                  <motion.rect
                    x={cx + 1} width={barWidth} rx={2}
                    fill="var(--chart-2)"
                    initial={{ y: baseline, height: 0 }}
                    animate={{ y: baseline - expenseH, height: expenseH }}
                    transition={{ duration: 0.5, delay: i * 0.008 }}
                  />
                  <rect
                    x={cx - groupWidth / 2} y={PAD_TOP} width={groupWidth} height={PLOT_H}
                    fill="transparent"
                    onMouseEnter={() => setHoverIndex(i)}
                    onMouseLeave={() => setHoverIndex(null)}
                    className="cursor-default"
                  />
                </g>
              )
            })}
          </svg>

          {hoverIndex !== null && (
            <div
              className="absolute pointer-events-none bg-popover border rounded-lg shadow-md px-2.5 py-2 text-xs space-y-1 -translate-x-1/2 z-10"
              style={{ left: `${(xForGroup(hoverIndex) / VIEW_W) * 100}%`, top: 0 }}
            >
              <p className="font-medium text-popover-foreground">{data[hoverIndex].label}</p>
              <p className="flex items-center gap-1.5"><span className="inline-block w-2 h-2 rounded-full bg-chart-1" /><span className="font-semibold">{formatCurrency(data[hoverIndex].income, currency)}</span></p>
              <p className="flex items-center gap-1.5"><span className="inline-block w-2 h-2 rounded-full bg-chart-2" /><span className="font-semibold">{formatCurrency(data[hoverIndex].expense, currency)}</span></p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
