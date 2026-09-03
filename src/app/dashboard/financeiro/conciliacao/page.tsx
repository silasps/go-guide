import { createClient } from '@/lib/supabase/server'
import { getActiveProfile } from '@/lib/profile/active-profile'
import { ReconciliationQueue } from '@/components/financial/reconciliation-queue'
import { resolveBudgetCategoryLabel } from '@/lib/highlights/budget-category-labels'

export default async function ConciliacaoPage() {
  const supabase = await createClient()
  const profile = await getActiveProfile()

  const { data: pledges } = await supabase
    .from('pledges')
    .select('*, highlight:highlights(title)')
    .eq('profile_id', profile!.id)
    .eq('status', 'pending')
    .order('reported_at', { ascending: false })

  const { data: accounts } = await supabase.from('financial_accounts').select('*').order('created_at')
  // Confirmar uma oferta pendente é sempre uma alocação nova — conta
  // arquivada (ver 7.29) não deve ser destino de nada novo.
  const activeAccounts = (accounts ?? []).filter((a) => !a.archived)

  const highlightIds = [...new Set((pledges ?? []).map(p => p.highlight_id).filter((id): id is string => !!id))]
  const { data: categories } = highlightIds.length > 0
    ? await supabase.from('project_budget_categories').select('*').in('highlight_id', highlightIds)
    : { data: [] }
  const budgetCategoriesByHighlight: Record<string, { id: string; label: string }[]> = {}
  for (const c of categories ?? []) {
    budgetCategoriesByHighlight[c.highlight_id] ??= []
    budgetCategoriesByHighlight[c.highlight_id].push({ id: c.id, label: resolveBudgetCategoryLabel(c) })
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium">{pledges?.length ?? 0} oferta(s) aguardando confirmação</p>
        <p className="text-xs text-muted-foreground mt-0.5">Confira o valor e escolha em qual conta cada uma caiu — confirmar gera o lançamento; rejeitar descarta sem afetar seu saldo.</p>
      </div>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <ReconciliationQueue pledges={(pledges ?? []) as any} accounts={activeAccounts} profileId={profile!.id} budgetCategoriesByHighlight={budgetCategoriesByHighlight} />
    </div>
  )
}
