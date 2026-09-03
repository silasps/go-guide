'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { formatCurrency } from '@/lib/utils'
import { CategorySlice } from '@/lib/financial/dashboard-aggregation'
import { Table2, BarChart3 } from 'lucide-react'

interface Props {
  data: CategorySlice[]
  currency: string
  monthLabel: string
  emptyLabel?: (monthLabel: string) => string
}

// chart-1/chart-2 são entrada/saída (TrendChart) — categorias começam no
// slot 3 pra não repetir a mesma cor com significado diferente na mesma
// tela. "Outros" nunca leva matiz categórico: é um bucket residual, não
// uma identidade real (dataviz skill).
const CATEGORY_COLOR_VARS = ['var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)', 'var(--chart-6)', 'var(--chart-7)', 'var(--chart-8)']
const OTHER_COLOR_VAR = 'var(--muted-foreground)'

// Composição de gastos por categoria — part-to-whole, barra horizontal
// (dataviz skill desaconselha pizza pra esse job, principalmente com nomes
// longos). Cada barra já É o alvo de clique/hover (não crosshair — regra
// da skill pra bar/cell): navega pro lançamento filtrado por categoria.
export function CategoryBarChart({ data, currency, monthLabel, emptyLabel }: Props) {
  const router = useRouter()
  const [showTable, setShowTable] = useState(false)

  if (data.length === 0) {
    const label = emptyLabel ? emptyLabel(monthLabel.toLowerCase()) : `Nenhuma despesa categorizada em ${monthLabel.toLowerCase()}.`
    return <p className="text-sm text-muted-foreground py-12 text-center">{label}</p>
  }

  function goToCategory(id: string) {
    if (id === '__other__' || id === '__uncategorized__') return
    router.push(`/dashboard/financeiro/lancamentos?category=${id}`)
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-end">
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
                <th className="py-1.5 pr-3 font-medium">Categoria</th>
                <th className="py-1.5 pr-3 font-medium">Valor</th>
                <th className="py-1.5 font-medium">%</th>
              </tr>
            </thead>
            <tbody>
              {data.map((c) => (
                <tr key={c.id} className="border-b border-border/50 last:border-0">
                  <td className="py-1.5 pr-3">{c.name}</td>
                  <td className="py-1.5 pr-3">{formatCurrency(c.amount, currency)}</td>
                  <td className="py-1.5">{c.pct.toFixed(0)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="space-y-2.5">
          {data.map((c, i) => {
            const color = c.id === '__other__' ? OTHER_COLOR_VAR : CATEGORY_COLOR_VARS[i % CATEGORY_COLOR_VARS.length]
            const clickable = c.id !== '__other__' && c.id !== '__uncategorized__'
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => goToCategory(c.id)}
                disabled={!clickable}
                className="w-full text-left group disabled:cursor-default"
              >
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className={clickable ? 'group-hover:underline' : ''}>{c.name}</span>
                  <span className="text-muted-foreground shrink-0 ml-2">{formatCurrency(c.amount, currency)} · {c.pct.toFixed(0)}%</span>
                </div>
                <div className="h-3 rounded-full bg-muted overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ backgroundColor: color }}
                    initial={{ width: 0 }}
                    animate={{ width: `${c.pct}%` }}
                    transition={{ duration: 0.6, delay: i * 0.05, ease: 'easeOut' }}
                  />
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
