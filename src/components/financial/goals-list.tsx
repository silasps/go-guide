'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { usePendingAction } from '@/hooks/use-pending-action'
import { formatCurrency, formatDate } from '@/lib/utils'
import { FinancialGoal } from '@/types/database'
import { GoalForm } from './goal-form'
import { GoalContributionDialog } from './goal-contribution-dialog'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Pencil, Trash2, Loader2, PlusCircle, PartyPopper } from 'lucide-react'

interface Props {
  goals: FinancialGoal[]
  profileId: string
  currencies: string[]
}

export function GoalsList({ goals, profileId, currencies }: Props) {
  const router = useRouter()
  const { pendingValue: deletingId, run } = usePendingAction<string>()
  const [editing, setEditing] = useState<FinancialGoal | null>(null)
  const [contributingTo, setContributingTo] = useState<FinancialGoal | null>(null)

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

  if (goals.length === 0) {
    return <p className="text-sm text-muted-foreground py-8 text-center">Nenhuma meta de economia cadastrada.</p>
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {goals.map((goal) => {
        const pct = goal.target_amount > 0 ? Math.min(100, (goal.current_amount / goal.target_amount) * 100) : 0
        const achieved = !!goal.achieved_at
        return (
          <div key={goal.id} className="rounded-xl border bg-card p-3.5 space-y-2.5">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium truncate flex items-center gap-1.5">
                {achieved && <PartyPopper className="h-3.5 w-3.5 text-chart-1 shrink-0" />}
                {goal.name}
              </p>
              {achieved && <Badge variant="success">Alcançada</Badge>}
            </div>
            <p className="text-xs text-muted-foreground">
              {formatCurrency(goal.current_amount, goal.currency)} de {formatCurrency(goal.target_amount, goal.currency)}
              {goal.target_date && ` · até ${formatDate(goal.target_date)}`}
            </p>
            <Progress value={pct} className="h-1.5" />
            <div className="flex gap-2">
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

      {editing && (
        <GoalForm open onOpenChange={(v) => !v && setEditing(null)} goal={editing} profileId={profileId} currencies={currencies} />
      )}
      {contributingTo && (
        <GoalContributionDialog open onOpenChange={(v) => !v && setContributingTo(null)} goal={contributingTo} />
      )}
    </div>
  )
}
