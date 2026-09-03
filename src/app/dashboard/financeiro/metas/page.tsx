import { createClient } from '@/lib/supabase/server'
import { getActiveProfile } from '@/lib/profile/active-profile'
import { GoalsList } from '@/components/financial/goals-list'
import { NewGoalButton } from '@/components/financial/new-goal-button'

export default async function MetasPage() {
  const supabase = await createClient()
  const profile = await getActiveProfile()

  const [{ data: accounts }, { data: goals }] = await Promise.all([
    supabase.from('financial_accounts').select('currency_code').order('created_at'),
    supabase.from('financial_goals').select('*').eq('profile_id', profile!.id).order('created_at', { ascending: false }),
  ])

  const currencies = [...new Set((accounts ?? []).map((a) => a.currency_code))]
  if (currencies.length === 0) currencies.push('BRL')

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <p className="text-sm text-muted-foreground">Metas de economia — valor alvo e progresso, atualizado manualmente.</p>
        <NewGoalButton profileId={profile!.id} currencies={currencies} />
      </div>
      <GoalsList goals={goals ?? []} profileId={profile!.id} currencies={currencies} />
    </div>
  )
}
