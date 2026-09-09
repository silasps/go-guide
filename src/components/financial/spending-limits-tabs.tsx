'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { GeneralSpendingLimit, SpendingLimit, TransactionCategory } from '@/types/database'
import { CategorySlice } from '@/lib/financial/dashboard-aggregation'
import { GeneralLimitSettings } from './general-limit-settings'
import { GeneralLimitOverview } from './general-limit-overview'
import { SpendingLimitsOverview } from './spending-limits-overview'
import { SpendingLimitsByCategory } from './spending-limits-by-category'

interface Props {
  limits: SpendingLimit[]
  categories: TransactionCategory[] // só categorias de topo
  spentByCategory: Record<string, number>
  profileId: string
  currencies: string[]
  totalSpent: number // toda despesa categorizada do mês (não só categorias com limite) — mesmo número nas duas abas, ver page.tsx
  totalLimit: number
  overviewCurrency: string
  todayPct: number | null
  generalLimit: GeneralSpendingLimit | null
  categoryBreakdown: CategorySlice[]
  monthLabel: string
}

const TABS = [
  { value: 'general', label: 'Geral' },
  { value: 'category', label: 'Por categoria' },
] as const

// Mesmo padrão de abas sem biblioteca (botões + cn) já usado em
// `CategoryPanel`/`MonthTransactionsPanel` (ver 7.21/7.22). "Geral"
// (7.36-bis) é o painel de configuração + visão consolidada estilo
// GranaZen; "Por categoria" é a lista com o marcador "Hoje" (7.36).
// Continua abrindo em "Por categoria" por padrão — pedido explícito do
// usuário, diferente do GranaZen (que abre em "Geral").
export function SpendingLimitsTabs({
  limits,
  categories,
  spentByCategory,
  profileId,
  currencies,
  totalSpent,
  totalLimit,
  overviewCurrency,
  todayPct,
  generalLimit,
  categoryBreakdown,
  monthLabel,
}: Props) {
  const [tab, setTab] = useState<(typeof TABS)[number]['value']>('category')

  // 76px = padding-top do card (p-4, 16px) + altura do bloco de título do
  // `SpendingLimitsOverview` (duas linhas de texto + `space-y-1`/`space-y-2`
  // entre elas, ~60px) — ponto exato onde a barra total começa, pra "Hoje"
  // nascer colado nela. Ajustado à mão pro markup atual do overview; se o
  // cabeçalho dele mudar de altura, ajustar aqui também.
  const showTodayMarker = todayPct !== null && totalLimit > 0

  // Ideia do usuário: com o limite geral em modo "soma por categoria",
  // categoria sem limite próprio passa a valer como limite R$0 nos cards de
  // "Por categoria" — qualquer gasto nela já aparece "estourado", forçando
  // a pessoa a definir um limite de verdade (só faz sentido nesse modo; em
  // "valor único" o total não depende de limite nenhum por categoria).
  const enforceZeroLimit = !!generalLimit?.enabled && generalLimit.mode === 'sum_categories'

  return (
    <div className="space-y-4">
      <div className="inline-flex items-center h-9 rounded-lg bg-muted p-1 text-muted-foreground">
        {TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setTab(t.value)}
            className={cn(
              'h-7 rounded-md px-3 text-sm font-medium transition-all',
              tab === t.value ? 'bg-background text-foreground shadow' : 'hover:text-foreground'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'general' ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
          <div className="xl:order-1 xl:col-span-4">
            <GeneralLimitSettings profileId={profileId} settings={generalLimit} categoriesTotal={totalLimit} currency={overviewCurrency} />
          </div>
          <div className="xl:order-2 xl:col-span-8">
            <GeneralLimitOverview
              settings={generalLimit}
              categoriesTotalLimit={totalLimit}
              totalSpent={totalSpent}
              currency={overviewCurrency}
              categoryBreakdown={categoryBreakdown}
              monthLabel={monthLabel}
            />
          </div>
        </div>
      ) : (
        <div className="relative rounded-xl border bg-card p-4 space-y-4">
          <SpendingLimitsOverview totalSpent={totalSpent} totalLimit={totalLimit} currency={overviewCurrency} />
          <SpendingLimitsByCategory categories={categories} limits={limits} spentByCategory={spentByCategory} profileId={profileId} currencies={currencies} enforceZeroLimit={enforceZeroLimit} />

          {showTodayMarker && (
            <div className="pointer-events-none absolute inset-y-0" style={{ left: `${todayPct}%` }}>
              <span className="absolute top-[76px] -translate-x-1/2 rounded bg-background px-1 text-[10px] font-semibold text-muted-foreground border whitespace-nowrap">Hoje</span>
              <span className="absolute top-[76px] bottom-0 w-px -translate-x-1/2 bg-border" />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
