'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { usePendingAction } from '@/hooks/use-pending-action'
import { formatCurrency, formatDate } from '@/lib/utils'
import { FinancialGoal } from '@/types/database'
import { GoalForm } from './goal-form'
import { GoalContributionDialog } from './goal-contribution-dialog'
import { EmergencyFundCard, EmergencyFundWizard, EMERGENCY_FUND_GOAL_NAME } from './emergency-fund-wizard'
import { DonutChart } from '@/components/ui/charts/donut-chart'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Pencil, Trash2, Loader2, PlusCircle, PartyPopper } from 'lucide-react'

interface Props {
  goals: FinancialGoal[]
  profileId: string
  currencies: string[]
}

// Mesmos slots 3-8 da paleta categórica já validada (dataviz skill, ver
// 11.1) — cada meta é uma "identidade" (não uma série de gráfico que muda
// com filtro), cor atribuída por ordem de criação e reaproveitada tanto no
// anel de "Visão geral" quanto na barra de progresso do card da meta.
const GOAL_COLOR_VARS = ['var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)', 'var(--chart-6)', 'var(--chart-7)', 'var(--chart-8)']

function useGoalColors(goals: FinancialGoal[]) {
  return useMemo(() => {
    const byCreation = [...goals].sort((a, b) => a.created_at.localeCompare(b.created_at))
    return new Map(byCreation.map((g, i) => [g.id, GOAL_COLOR_VARS[i % GOAL_COLOR_VARS.length]]))
  }, [goals])
}

// "Visão geral" — quanto já foi guardado no total, e a fatia de cada meta
// nesse total (não a % da meta em relação ao próprio alvo, que já aparece
// no card individual abaixo). Escopado a UMA moeda por vez — nunca somar
// moedas diferentes (regra já estabelecida em toda a Fase 1 financeira).
function CurrencyOverview({ goals, currency, colorOf }: { goals: FinancialGoal[]; currency: string; colorOf: (id: string) => string }) {
  const total = goals.reduce((s, g) => s + g.current_amount, 0)
  const slices = goals
    .filter((g) => g.current_amount > 0)
    .map((g) => ({ id: g.id, label: g.name, value: g.current_amount, color: colorOf(g.id), pct: total > 0 ? (g.current_amount / total) * 100 : 0 }))

  return (
    <Card className="shadow-none">
      <CardContent className="flex flex-col items-stretch gap-5 p-5 sm:flex-row sm:items-center">
        {slices.length > 0 ? (
          <DonutChart slices={slices} centerLabel={formatCurrency(total, currency)} />
        ) : (
          <div className="flex size-32 shrink-0 items-center justify-center rounded-full border-2 border-dashed text-center text-xs text-muted-foreground px-3">
            Nada guardado ainda
          </div>
        )}
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Total guardado {currency}</p>
          <div className="space-y-1.5">
            {goals.map((g) => {
              const pct = total > 0 ? Math.round((g.current_amount / total) * 100) : 0
              return (
                <div key={g.id} className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: colorOf(g.id) }} />
                    <span className="truncate text-xs text-muted-foreground">{g.name}</span>
                  </div>
                  <span className="shrink-0 text-xs font-medium">{pct}%</span>
                </div>
              )
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function GoalsList({ goals, profileId, currencies }: Props) {
  const router = useRouter()
  const { pendingValue: deletingId, run } = usePendingAction<string>()
  const [editing, setEditing] = useState<FinancialGoal | null>(null)
  const [contributingTo, setContributingTo] = useState<FinancialGoal | null>(null)
  const [creatingReserve, setCreatingReserve] = useState(false)
  const colorMap = useGoalColors(goals)
  const colorOf = (id: string) => colorMap.get(id) ?? GOAL_COLOR_VARS[0]
  const hasEmergencyFund = goals.some((g) => g.name === EMERGENCY_FUND_GOAL_NAME)

  function remove(goal: FinancialGoal) {
    if (!confirm(`Excluir a meta "${goal.name}"?`)) return
    run(goal.id, async () => {
      const supabase = createClient()
      const { error } = await supabase.from('financial_goals').delete().eq('id', goal.id)
      if (error) { toast.error('Erro ao excluir meta.'); return }
      toast.success('Meta excluída.')
      router.refresh()
    })
  }

  const goalsByCurrency = new Map<string, FinancialGoal[]>()
  for (const g of goals) goalsByCurrency.set(g.currency, [...(goalsByCurrency.get(g.currency) ?? []), g])

  return (
    <div className="space-y-5">
      {!hasEmergencyFund && <EmergencyFundCard onStart={() => setCreatingReserve(true)} />}

      {goals.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Nenhuma meta de economia cadastrada.</p>
      ) : (
        <>
          <div className="space-y-2">
            <div>
              <h3 className="text-base font-semibold">Visão geral</h3>
              <p className="text-xs text-muted-foreground">Veja o quanto já guardou para cada meta.</p>
            </div>
            <div className="space-y-3">
              {[...goalsByCurrency.entries()].map(([currency, currencyGoals]) => (
                <CurrencyOverview key={currency} goals={currencyGoals} currency={currency} colorOf={colorOf} />
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {goals.map((goal) => {
              const pct = goal.target_amount > 0 ? Math.min(100, (goal.current_amount / goal.target_amount) * 100) : 0
              const missing = Math.max(0, goal.target_amount - goal.current_amount)
              const achieved = !!goal.achieved_at
              const color = colorOf(goal.id)
              return (
                <div key={goal.id} className="rounded-xl border bg-card p-3.5 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium truncate flex items-center gap-1.5 min-w-0">
                      <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                      {achieved && <PartyPopper className="h-3.5 w-3.5 text-chart-1 shrink-0" />}
                      <span className="truncate">{goal.name}</span>
                    </p>
                    {achieved && <Badge variant="success" className="shrink-0">Alcançada</Badge>}
                  </div>

                  <div className="flex items-end justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">Já guardado</p>
                      <p className="truncate text-sm font-semibold">{formatCurrency(goal.current_amount, goal.currency)}</p>
                    </div>
                    <div className="min-w-0 text-right">
                      <p className="text-xs text-muted-foreground">Valor da meta</p>
                      <p className="truncate text-sm font-semibold">{formatCurrency(goal.target_amount, goal.currency)}</p>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="h-2 w-full overflow-hidden rounded-full bg-primary/15">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
                    </div>
                    <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                      <span className="min-w-0 truncate">{achieved ? 'Meta concluída' : `Faltam ${formatCurrency(missing, goal.currency)}`}</span>
                      <span className="shrink-0 font-medium">{Math.round(pct)}%</span>
                    </div>
                  </div>

                  {goal.target_date && <p className="text-xs text-muted-foreground">Prazo: {formatDate(goal.target_date)}</p>}

                  <div className="flex gap-2 pt-0.5">
                    <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setContributingTo(goal)}>
                      <PlusCircle className="h-3.5 w-3.5" /> Registrar valor
                    </Button>
                    <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setEditing(goal)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="outline" size="sm" className="gap-1.5 ml-auto" onClick={() => remove(goal)} disabled={deletingId === goal.id}>
                      {deletingId === goal.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {editing && (
        <GoalForm open onOpenChange={(v) => !v && setEditing(null)} goal={editing} profileId={profileId} currencies={currencies} />
      )}
      {contributingTo && (
        <GoalContributionDialog open onOpenChange={(v) => !v && setContributingTo(null)} goal={contributingTo} />
      )}
      {creatingReserve && (
        <EmergencyFundWizard open onOpenChange={(v) => !v && setCreatingReserve(false)} profileId={profileId} currency={currencies[0] ?? 'BRL'} />
      )}
    </div>
  )
}
