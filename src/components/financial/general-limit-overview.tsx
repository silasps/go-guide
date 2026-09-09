import { formatCurrency, cn } from '@/lib/utils'
import { GeneralSpendingLimit } from '@/types/database'
import { CategorySlice } from '@/lib/financial/dashboard-aggregation'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { CategoryBarChart } from '@/components/ui/charts/category-bar-chart'
import { CircleCheck, TriangleAlert } from 'lucide-react'

interface Props {
  settings: GeneralSpendingLimit | null
  categoriesTotalLimit: number
  totalSpent: number
  currency: string
  categoryBreakdown: CategorySlice[]
  monthLabel: string
}

// `fillPct` (0-100) desenha o anel — não dá pra desenhar além de uma volta
// inteira. `labelPct` é o número mostrado no centro, sem cap: passar de
// 100% do limite deve aparecer como 200%, 350% etc., não travar em 100%
// (pedido do usuário).
function Gauge({ fillPct, labelPct, colorClass }: { fillPct: number; labelPct: number; colorClass: string }) {
  const size = 112
  const stroke = 10
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const offset = c - (Math.min(100, fillPct) / 100) * c
  return (
    <div className="relative mx-auto" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--muted)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          className={cn('transition-all', colorClass)}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={cn('text-lg font-bold', colorClass)}>{Math.round(labelPct)}%</span>
      </div>
    </div>
  )
}

function StatBox({ label, value, colorClass }: { label: string; value: string; colorClass?: string }) {
  return (
    <div className="w-full rounded-lg border p-3">
      <p className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn('text-base font-semibold', colorClass)}>{value}</p>
    </div>
  )
}

// Card "Limite de gastos geral" estilo GranaZen — consolida
// `general_spending_limits` (configurado em `GeneralLimitSettings`, ao
// lado) com o gasto real do mês. "Gasto total" aqui é TODA despesa
// categorizada do mês (não só das categorias com limite individual — o
// HTML de referência é explícito: "Mostra todos os gastos por categoria e
// subcategoria, com ou sem limite cadastrado"). Mesmo número usado no card
// "Gastos por categoria" da aba "Por categoria" (`totalSpent`, unificado a
// pedido do usuário — antes eram dois escopos diferentes e as duas abas
// mostravam porcentagens diferentes pro "mesmo" limite total, confuso).
export function GeneralLimitOverview({ settings, categoriesTotalLimit, totalSpent, currency, categoryBreakdown, monthLabel }: Props) {
  const enabled = settings?.enabled ?? false
  const effectiveLimit = enabled ? (settings?.mode === 'manual' ? (settings?.manual_amount ?? 0) : categoriesTotalLimit) : 0
  const rawPct = effectiveLimit > 0 ? (totalSpent / effectiveLimit) * 100 : 0
  const pct = Math.min(100, rawPct)
  const threshold = settings?.notify_threshold_pct ?? 100
  const status: 'ok' | 'warn' | 'over' = rawPct >= 100 ? 'over' : rawPct >= threshold ? 'warn' : 'ok'
  const colorClass = !enabled ? 'text-muted-foreground' : status === 'over' ? 'text-destructive' : status === 'warn' ? 'text-warning' : 'text-success'
  const remaining = Math.max(0, effectiveLimit - totalSpent)

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2 pb-2">
        <div>
          <CardTitle>Limite de gastos geral</CardTitle>
          <CardDescription>Visão consolidada dos limites ativos</CardDescription>
        </div>
        {enabled ? (
          <Badge variant={status === 'over' ? 'destructive' : status === 'warn' ? 'outline' : 'success'} className={cn('gap-1', status === 'warn' && 'border-warning/40 bg-warning/10 text-warning')}>
            {status === 'over' ? <TriangleAlert className="h-3 w-3" /> : <CircleCheck className="h-3 w-3" />}
            {status === 'over' ? 'Limite ultrapassado' : status === 'warn' ? 'Perto do limite' : 'Dentro do limite'}
          </Badge>
        ) : (
          <Badge variant="outline" className="text-muted-foreground">Sem limite configurado</Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid grid-cols-1 items-center gap-5 lg:grid-cols-[112px_minmax(0,1fr)]">
          <Gauge fillPct={pct} labelPct={rawPct} colorClass={colorClass} />
          <div className="min-w-0 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Uso do limite consolidado</span>
              <span className={cn('font-semibold', colorClass)}>{Math.round(rawPct)}%</span>
            </div>
            <Progress
              value={pct}
              className={cn(status === 'over' && '[&_[data-slot=progress-indicator]]:bg-destructive', status === 'warn' && '[&_[data-slot=progress-indicator]]:bg-warning')}
            />
            <div className="text-sm text-muted-foreground">
              {enabled ? `${formatCurrency(totalSpent, currency)} de ${formatCurrency(effectiveLimit, currency)} utilizados no período.` : 'Ative o limite geral para visualizar o gasto total consolidado.'}
            </div>
          </div>
        </div>

        <div className="h-px w-full bg-border" />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatBox label="Gasto total" value={enabled ? formatCurrency(totalSpent, currency) : '-'} colorClass={enabled ? 'text-success' : undefined} />
          <StatBox label="Limite total" value={enabled ? formatCurrency(effectiveLimit, currency) : 'Não definido'} />
          <StatBox label="Restante" value={formatCurrency(remaining, currency)} />
        </div>

        <section className="rounded-lg border bg-background p-4 md:p-5">
          <h3 className="text-base font-semibold leading-6">Gastos por categoria e subcategoria em geral</h3>
          <p className="mt-1 text-sm leading-5 text-muted-foreground">Mostra todos os gastos por categoria e subcategoria, com ou sem limite cadastrado.</p>
          <div className="mt-4">
            <CategoryBarChart data={categoryBreakdown} currency={currency} monthLabel={monthLabel} emptyLabel={(m) => `Sem gastos registrados para montar o gráfico em ${m}.`} />
          </div>
        </section>
      </CardContent>
    </Card>
  )
}
