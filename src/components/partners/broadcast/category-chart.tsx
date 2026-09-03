'use client'

import { motion } from 'framer-motion'
import { formatCurrency } from '@/lib/utils'

// chart-1/chart-2 são entrada/saída (BroadcastStatTile) — categorias começam
// no slot 3 pra não repetir cor com significado diferente na mesma página
// (mesma regra de src/components/ui/charts/category-bar-chart.tsx). "Outros"
// nunca leva matiz categórico — bucket residual, não uma categoria de
// verdade (dataviz skill).
const CATEGORY_COLOR_VARS = ['var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)', 'var(--chart-6)', 'var(--chart-7)', 'var(--chart-8)']
const OTHER_COLOR_VAR = 'var(--muted-foreground)'

export interface CategoryChartItem {
  name: string
  pct: number
  amount?: number
}

interface Props {
  items: CategoryChartItem[]
  currency: string
  heading: string
  footnote?: string
}

// Composição de gastos por categoria — reaproveita o mesmo tipo de gráfico
// (barra horizontal, part-to-whole) do dashboard financeiro (11.1), com os
// `items` já computados e redigidos no Server Component da página (nunca
// recebe o `financial_snapshot` bruto — só o array final, com ou sem
// `amount` dependendo se o visitante está autorizado a ver valor exato).
export function BroadcastCategoryChart({ items, currency, heading, footnote }: Props) {
  if (items.length === 0) return null

  return (
    <div className="bg-card border rounded-2xl p-4 space-y-3">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{heading}</p>
      <div className="space-y-2.5">
        {items.map((item, i) => {
          const isOther = item.name === 'Outros' || item.name === 'Outras categorias'
          const color = isOther ? OTHER_COLOR_VAR : CATEGORY_COLOR_VARS[i % CATEGORY_COLOR_VARS.length]
          return (
            <div key={item.name} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium">{item.name}</span>
                <span className="text-muted-foreground">
                  {item.amount !== undefined ? `${formatCurrency(item.amount, currency)} · ` : ''}{item.pct}%
                </span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  style={{ backgroundColor: color }}
                  initial={{ width: 0 }}
                  animate={{ width: `${item.pct}%` }}
                  transition={{ duration: 0.6, delay: i * 0.06, ease: 'easeOut' }}
                />
              </div>
            </div>
          )
        })}
      </div>
      {footnote && <p className="text-xs text-muted-foreground">{footnote}</p>}
    </div>
  )
}
