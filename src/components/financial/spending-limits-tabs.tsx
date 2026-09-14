'use client'

import { useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import { GeneralSpendingLimit, SpendingLimit, Transaction, TransactionCategory } from '@/types/database'
import { aggregateByCategory } from '@/lib/financial/dashboard-aggregation'
import { GeneralLimitSettings } from './general-limit-settings'
import { GeneralLimitOverview } from './general-limit-overview'
import { SpendingLimitsOverview } from './spending-limits-overview'
import { SpendingLimitsByCategory } from './spending-limits-by-category'

interface Props {
  limits: SpendingLimit[]
  categories: TransactionCategory[] // só categorias de topo
  allCategories: TransactionCategory[] // topo + subcategoria, pra resolver nome no gráfico "por categoria e subcategoria"
  monthExpenses: Transaction[] // cru, todas as moedas — cada aba agrega escopado à própria moeda (ver comentário abaixo)
  month: string
  profileId: string
  currencies: string[]
  todayPct: number | null
  generalLimit: GeneralSpendingLimit | null
  monthLabel: string
}

// Limite só existe na categoria de TOPO, mas um lançamento pode estar
// marcado numa subcategoria dela — sem subir da subcategoria pro pai, o
// gasto de "Alimentação > Supermercado" nunca contava pro limite de
// "Alimentação" (achado com dados reais do usuário: limite de R$1.400
// aparecendo zerado mesmo com gasto de verdade na subcategoria).
function sumByTopCategory(expenses: Transaction[], allCategories: TransactionCategory[]) {
  const categoryParentId = new Map(allCategories.map((c) => [c.id, c.parent_id]))
  const topCategoryId = (categoryId: string) => categoryParentId.get(categoryId) ?? categoryId
  const spentByCategory: Record<string, number> = {}
  for (const t of expenses) {
    if (!t.category_id) continue
    const key = topCategoryId(t.category_id)
    spentByCategory[key] = (spentByCategory[key] ?? 0) + t.amount
  }
  return spentByCategory
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
  allCategories,
  monthExpenses,
  month,
  profileId,
  currencies,
  todayPct,
  generalLimit,
  monthLabel,
}: Props) {
  const [tab, setTab] = useState<(typeof TABS)[number]['value']>('category')
  // Mesmo padrão de `financial-dashboard.tsx`/`reports-analytics.tsx`:
  // só filtra de verdade quando há mais de uma moeda em jogo — com uma só,
  // não tem o que trocar e o seletor nem aparece.
  const [currency, setCurrency] = useState(currencies[0] ?? 'BRL')

  // Aba "Por categoria": escopada pela moeda escolhida no seletor acima.
  const limitsInCurrency = useMemo(() => limits.filter((l) => l.currency === currency), [limits, currency])
  const expensesInCurrency = useMemo(() => monthExpenses.filter((t) => t.currency === currency), [monthExpenses, currency])
  const spentByCategory = useMemo(() => sumByTopCategory(expensesInCurrency, allCategories), [expensesInCurrency, allCategories])
  const totalLimit = useMemo(() => limitsInCurrency.reduce((s, l) => s + l.limit_amount, 0), [limitsInCurrency])
  const totalSpent = useMemo(() => Object.values(spentByCategory).reduce((s, v) => s + v, 0), [spentByCategory])

  // Aba "Geral": `general_spending_limits` é `UNIQUE(profile_id)` — uma
  // linha só por perfil, só representa UMA moeda de cada vez (estrutural,
  // não segue o seletor acima). Usa a moeda do próprio limite já salvo
  // (estável) em vez de adivinhar a partir do primeiro `spending_limits`
  // criado (jeito antigo, `overviewCurrency` — arbitrário e, pior, regravado
  // a cada save de `GeneralLimitSettings`, então qualquer toggle não
  // relacionado já reescrevia silenciosamente a moeda salva se aquele
  // palpite tivesse mudado nesse meio tempo).
  const generalCurrency = generalLimit?.currency ?? currencies[0] ?? 'BRL'
  const expensesInGeneralCurrency = useMemo(() => monthExpenses.filter((t) => t.currency === generalCurrency), [monthExpenses, generalCurrency])
  const generalSpentByCategory = useMemo(() => sumByTopCategory(expensesInGeneralCurrency, allCategories), [expensesInGeneralCurrency, allCategories])
  const generalTotalLimit = useMemo(() => limits.filter((l) => l.currency === generalCurrency).reduce((s, l) => s + l.limit_amount, 0), [limits, generalCurrency])
  const generalTotalSpent = useMemo(() => Object.values(generalSpentByCategory).reduce((s, v) => s + v, 0), [generalSpentByCategory])
  // Esse gráfico é "por categoria E subcategoria" (rótulo da própria seção)
  // — diferente de `spentByCategory`, aqui NÃO soma subcategoria no pai:
  // cada uma aparece como fatia própria, por isso usa `allCategories` (não
  // só as de topo) pra resolver o nome certo em vez de cair em "Sem categoria".
  const categoryBreakdown = useMemo(() => aggregateByCategory(expensesInGeneralCurrency, allCategories, month), [expensesInGeneralCurrency, allCategories, month])

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
      <div className="flex flex-wrap items-center gap-3">
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
        {tab === 'category' && currencies.length > 1 && (
          <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="h-7 rounded-lg border border-input bg-transparent px-2 text-xs outline-none">
            {currencies.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
      </div>

      {tab === 'general' ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
          {currencies.length > 1 && (
            <p className="xl:col-span-12 text-xs text-muted-foreground">
              O limite geral vale só pra uma moeda por vez — está configurado em <span className="font-medium text-foreground">{generalCurrency}</span>, independente da moeda escolhida na aba &quot;Por categoria&quot;.
            </p>
          )}
          <div className="xl:order-1 xl:col-span-4">
            <GeneralLimitSettings profileId={profileId} settings={generalLimit} categoriesTotal={generalTotalLimit} currency={generalCurrency} />
          </div>
          <div className="xl:order-2 xl:col-span-8">
            <GeneralLimitOverview
              settings={generalLimit}
              categoriesTotalLimit={generalTotalLimit}
              totalSpent={generalTotalSpent}
              currency={generalCurrency}
              categoryBreakdown={categoryBreakdown}
              monthLabel={monthLabel}
            />
          </div>
        </div>
      ) : (
        <div className="relative rounded-xl border bg-card p-4 space-y-4">
          <SpendingLimitsOverview totalSpent={totalSpent} totalLimit={totalLimit} currency={currency} />
          <SpendingLimitsByCategory categories={categories} limits={limitsInCurrency} spentByCategory={spentByCategory} profileId={profileId} currencies={currencies} enforceZeroLimit={enforceZeroLimit} />

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
