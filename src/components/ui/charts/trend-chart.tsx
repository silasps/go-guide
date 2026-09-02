'use client'

import { useId, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { formatCurrency } from '@/lib/utils'
import { MonthlyPoint } from '@/lib/financial/dashboard-aggregation'
import { Table2, LineChart as LineChartIcon } from 'lucide-react'

interface Props {
  data: MonthlyPoint[]
  currency: string
  selectedMonth: string | null
  onSelectMonth: (month: string) => void
}

const VIEW_W = 600
const VIEW_H = 240
const PAD_TOP = 16
const PAD_BOTTOM = 32
const PAD_LEFT = 48
const PAD_RIGHT = 12
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

// Gráfico de linha/área — entradas vs. saídas mês a mês (dataviz skill:
// trend over time, 2 séries -> line chart, cor categórica chart-1/chart-2).
// Crosshair único (não hit-rect por ponto, é linha) rastreia o mês mais
// próximo; clicar seleciona o mês (onSelectMonth) pra escopar o gráfico de
// categoria abaixo. Toggle de tabela = par de acessibilidade da skill.
export function TrendChart({ data, currency, selectedMonth, onSelectMonth }: Props) {
  const gradientId = useId()
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)
  const [showTable, setShowTable] = useState(false)

  const maxValue = useMemo(() => niceMax(Math.max(...data.map((p) => Math.max(p.income, p.expense)), 0)), [data])
  const hasData = data.some((p) => p.income > 0 || p.expense > 0)

  function xFor(i: number) {
    return data.length <= 1 ? PAD_LEFT + PLOT_W / 2 : PAD_LEFT + (i / (data.length - 1)) * PLOT_W
  }
  function yFor(v: number) {
    return PAD_TOP + (1 - v / maxValue) * PLOT_H
  }

  const incomePath = data.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xFor(i)},${yFor(p.income)}`).join(' ')
  const expensePath = data.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xFor(i)},${yFor(p.expense)}`).join(' ')
  const baseline = PAD_TOP + PLOT_H
  const incomeArea = `${incomePath} L ${xFor(data.length - 1)},${baseline} L ${xFor(0)},${baseline} Z`
  const expenseArea = `${expensePath} L ${xFor(data.length - 1)},${baseline} L ${xFor(0)},${baseline} Z`

  function indexFromX(clientX: number, svgEl: SVGSVGElement) {
    const rect = svgEl.getBoundingClientRect()
    const relX = ((clientX - rect.left) / rect.width) * VIEW_W
    const ratio = (relX - PAD_LEFT) / PLOT_W
    return Math.min(data.length - 1, Math.max(0, Math.round(ratio * (data.length - 1))))
  }

  const gridLines = [0, 0.33, 0.66, 1]

  // Afinar os labels do eixo X pra no máximo ~6 aparecerem (senão colidem
  // com muitos meses) — sempre com o mês mais recente presente, sem deixar
  // o penúltimo grudar nele.
  const monthLabelStride = Math.max(1, Math.ceil(data.length / 6))
  const shownMonthIndices = new Set<number>()
  for (let i = 0; i < data.length; i += monthLabelStride) shownMonthIndices.add(i)
  shownMonthIndices.add(data.length - 1)
  if (shownMonthIndices.has(data.length - 2) && shownMonthIndices.has(data.length - 1)) {
    shownMonthIndices.delete(data.length - 2)
  }

  if (!hasData) {
    return <p className="text-sm text-muted-foreground py-12 text-center">Sem lançamentos no período selecionado.</p>
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 text-xs">
          <span className="inline-flex items-center gap-1.5"><span className="inline-block w-3 h-0.5 rounded-full bg-chart-1" />Entradas</span>
          <span className="inline-flex items-center gap-1.5"><span className="inline-block w-3 h-0.5 rounded-full bg-chart-2" />Saídas</span>
        </div>
        <button type="button" onClick={() => setShowTable((v) => !v)} className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
          {showTable ? <LineChartIcon className="h-3.5 w-3.5" /> : <Table2 className="h-3.5 w-3.5" />}
          {showTable ? 'Ver gráfico' : 'Ver como tabela'}
        </button>
      </div>

      {showTable ? (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-muted-foreground border-b">
                <th className="py-1.5 pr-3 font-medium">Mês</th>
                <th className="py-1.5 pr-3 font-medium">Entradas</th>
                <th className="py-1.5 font-medium">Saídas</th>
              </tr>
            </thead>
            <tbody>
              {data.map((p) => (
                <tr key={p.month} className="border-b border-border/50 last:border-0">
                  <td className="py-1.5 pr-3">{p.monthLabel}</td>
                  <td className="py-1.5 pr-3">{formatCurrency(p.income, currency)}</td>
                  <td className="py-1.5">{formatCurrency(p.expense, currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="relative">
          <svg
            viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
            className="w-full h-auto touch-none cursor-pointer"
            role="img"
            aria-label="Entradas e saídas por mês"
            tabIndex={0}
            onPointerMove={(e) => setHoverIndex(indexFromX(e.clientX, e.currentTarget))}
            onPointerLeave={() => setHoverIndex(null)}
            onClick={(e) => onSelectMonth(data[indexFromX(e.clientX, e.currentTarget)].month)}
            onKeyDown={(e) => {
              const current = hoverIndex ?? data.findIndex((p) => p.month === selectedMonth) ?? 0
              if (e.key === 'ArrowRight') { e.preventDefault(); setHoverIndex(Math.min(data.length - 1, current + 1)) }
              if (e.key === 'ArrowLeft') { e.preventDefault(); setHoverIndex(Math.max(0, current - 1)) }
              if ((e.key === 'Enter' || e.key === ' ') && hoverIndex !== null) { e.preventDefault(); onSelectMonth(data[hoverIndex].month) }
            }}
          >
            <defs>
              <linearGradient id={`${gradientId}-income`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--chart-1)" stopOpacity="0.1" />
                <stop offset="100%" stopColor="var(--chart-1)" stopOpacity="0" />
              </linearGradient>
              <linearGradient id={`${gradientId}-expense`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--chart-2)" stopOpacity="0.1" />
                <stop offset="100%" stopColor="var(--chart-2)" stopOpacity="0" />
              </linearGradient>
            </defs>

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

            {data.map((p, i) => {
              if (!shownMonthIndices.has(i)) return null
              // Ponta a ponta ancora pra dentro (start/end) em vez de
              // centralizado — evita o label do primeiro/último mês
              // estourar a viewBox.
              const anchor = i === 0 ? 'start' : i === data.length - 1 ? 'end' : 'middle'
              return (
                <text key={p.month} x={xFor(i)} y={VIEW_H - 8} textAnchor={anchor} fontSize={9.5} fill="var(--muted-foreground)">
                  {p.monthLabel}
                </text>
              )
            })}

            {selectedMonth && data.some((p) => p.month === selectedMonth) && (
              <rect
                x={xFor(data.findIndex((p) => p.month === selectedMonth)) - PLOT_W / (data.length * 2)}
                y={PAD_TOP}
                width={PLOT_W / data.length}
                height={PLOT_H}
                fill="var(--muted)"
                opacity={0.5}
              />
            )}

            {hoverIndex !== null && (
              <line x1={xFor(hoverIndex)} x2={xFor(hoverIndex)} y1={PAD_TOP} y2={baseline} stroke="var(--foreground)" strokeOpacity={0.25} strokeWidth={1} vectorEffect="non-scaling-stroke" />
            )}

            <path d={incomeArea} fill={`url(#${gradientId}-income)`} />
            <path d={expenseArea} fill={`url(#${gradientId}-expense)`} />

            <motion.path d={incomePath} fill="none" stroke="var(--chart-1)" strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round"
              initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.9, ease: 'easeInOut' }} />
            <motion.path d={expensePath} fill="none" stroke="var(--chart-2)" strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round"
              initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.9, ease: 'easeInOut', delay: 0.1 }} />

            {data.map((p, i) => (
              <g key={p.month}>
                <circle cx={xFor(i)} cy={yFor(p.income)} r={hoverIndex === i ? 5 : 4} fill="var(--chart-1)" stroke="var(--card)" strokeWidth={2} vectorEffect="non-scaling-stroke" />
                <circle cx={xFor(i)} cy={yFor(p.expense)} r={hoverIndex === i ? 5 : 4} fill="var(--chart-2)" stroke="var(--card)" strokeWidth={2} vectorEffect="non-scaling-stroke" />
              </g>
            ))}
          </svg>

          {hoverIndex !== null && (
            <div
              className="absolute pointer-events-none bg-popover border rounded-lg shadow-md px-2.5 py-2 text-xs space-y-1 -translate-x-1/2 z-10"
              style={{ left: `${(xFor(hoverIndex) / VIEW_W) * 100}%`, top: 0 }}
            >
              <p className="font-medium text-popover-foreground">{data[hoverIndex].monthLabel}</p>
              <p className="flex items-center gap-1.5"><span className="inline-block w-2 h-2 rounded-full bg-chart-1" /><span className="font-semibold">{formatCurrency(data[hoverIndex].income, currency)}</span></p>
              <p className="flex items-center gap-1.5"><span className="inline-block w-2 h-2 rounded-full bg-chart-2" /><span className="font-semibold">{formatCurrency(data[hoverIndex].expense, currency)}</span></p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
