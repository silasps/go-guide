'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useLocale, useTranslations } from 'next-intl'
import { ChevronDown } from 'lucide-react'
import { formatCurrency, INTL_LOCALE } from '@/lib/utils'
import type { Locale } from '@/types/database'

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
  /** Só presentes pra categorias reais (nunca no bucket residual "outros")
   *  — contagem de lançamentos e intervalo de datas no período, nunca a
   *  descrição de um lançamento individual (minimização de dado). Isso é o
   *  que a linha vira clicável pra revelar. */
  count?: number
  firstDate?: string
  lastDate?: string
  isOther?: boolean
}

interface Props {
  items: CategoryChartItem[]
  currency: string
  heading: string
  footnote?: string
}

function formatDateShort(iso: string, locale: Locale) {
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], { day: '2-digit', month: 'short' }).format(new Date(`${iso}T00:00:00`))
}

// Composição de gastos por categoria — reaproveita o mesmo tipo de gráfico
// (barra horizontal, part-to-whole) do dashboard financeiro (11.1), com os
// `items` já computados e redigidos no Server Component da página (nunca
// recebe o `financial_snapshot` bruto — só o array final, com ou sem
// `amount` dependendo se o visitante está autorizado a ver valor exato).
// Cada linha com `count` definido é clicável: expande uma sublinha com
// contagem de lançamentos + intervalo de datas — nunca o valor (isso
// continuaria gated por `amount` estar ou não presente) nem a descrição de
// um lançamento específico.
export function BroadcastCategoryChart({ items, currency, heading, footnote }: Props) {
  const t = useTranslations('PartnerUpdate')
  const locale = useLocale() as Locale
  const [expanded, setExpanded] = useState<string | null>(null)

  if (items.length === 0) return null

  return (
    <div className="bg-card border rounded-2xl p-4 space-y-3">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{heading}</p>
      <div className="space-y-2.5">
        {items.map((item, i) => {
          const color = item.isOther ? OTHER_COLOR_VAR : CATEGORY_COLOR_VARS[i % CATEGORY_COLOR_VARS.length]
          const canExpand = item.count !== undefined && item.firstDate && item.lastDate
          const isOpen = expanded === item.name
          return (
            <div key={item.name} className="space-y-1">
              <button
                type="button"
                disabled={!canExpand}
                onClick={() => setExpanded(isOpen ? null : item.name)}
                className={`w-full space-y-1 text-left -mx-2 px-2 py-1 rounded-lg transition-colors disabled:cursor-default ${canExpand ? 'hover:bg-muted/60 active:bg-muted' : ''}`}
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium flex items-center gap-1">
                    {item.name}
                    {canExpand && (
                      <ChevronDown className={`h-3 w-3 transition-transform ${isOpen ? 'rotate-180 text-foreground' : 'text-muted-foreground'}`} />
                    )}
                  </span>
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
              </button>
              <AnimatePresence initial={false}>
                {canExpand && isOpen && (
                  <motion.p
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="text-[11px] text-muted-foreground overflow-hidden"
                  >
                    {t('categoryDetail', { count: item.count!, from: formatDateShort(item.firstDate!, locale), to: formatDateShort(item.lastDate!, locale) })}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
          )
        })}
      </div>
      {footnote && <p className="text-xs text-muted-foreground">{footnote}</p>}
    </div>
  )
}
