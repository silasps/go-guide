import { createClient } from '@/lib/supabase/server'
import { getActiveProfile } from '@/lib/profile/active-profile'
import { ReconciliationTabs } from '@/components/financial/reconciliation-tabs'
import { resolveBudgetCategoryLabel } from '@/lib/highlights/budget-category-labels'
import { PLEDGE_RECONSIDERATION_DAYS, PLEDGE_ARCHIVE_DAYS, daysSince } from '@/lib/financial/pledge-windows'
import { Pledge } from '@/types/database'

type PledgeWithHighlight = Pledge & { highlight?: { title: string } | null }

export default async function ConciliacaoPage() {
  const supabase = await createClient()
  const profile = await getActiveProfile()

  // Recusada não some na hora — fica em destaque por
  // PLEDGE_RECONSIDERATION_DAYS (o apoiador pode aparecer com o
  // comprovante) e depois arquivada, ainda reconfirmável, até completar
  // PLEDGE_ARCHIVE_DAYS desde a recusa. Só então some da consulta.
  const { data: pledgesRaw } = await supabase
    .from('pledges')
    .select('*, highlight:highlights(title)')
    .eq('profile_id', profile!.id)
    .in('status', ['pending', 'rejected'])
    .order('reported_at', { ascending: false })

  const pledges = ((pledgesRaw ?? []) as unknown as PledgeWithHighlight[]).filter(
    (p) => p.status === 'pending' || (p.reviewed_at && daysSince(p.reviewed_at) < PLEDGE_ARCHIVE_DAYS)
  )
  const pendingPledges = pledges.filter((p) => p.status === 'pending')
  const recentRejectedPledges = pledges.filter((p) => p.status === 'rejected' && daysSince(p.reviewed_at!) < PLEDGE_RECONSIDERATION_DAYS)
  const archivedPledges = pledges.filter((p) => p.status === 'rejected' && daysSince(p.reviewed_at!) >= PLEDGE_RECONSIDERATION_DAYS)

  const { data: accounts } = await supabase.from('financial_accounts').select('*').order('created_at')
  // Confirmar uma oferta pendente é sempre uma alocação nova — conta
  // arquivada (ver 7.29) não deve ser destino de nada novo.
  const activeAccounts = (accounts ?? []).filter((a) => !a.archived)

  const highlightIds = [...new Set(pledges.map(p => p.highlight_id).filter((id): id is string => !!id))]
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
        <p className="text-sm font-medium">{pendingPledges.length} oferta(s) aguardando confirmação</p>
        <p className="text-xs text-muted-foreground mt-0.5">Confira o valor e escolha em qual conta cada uma caiu — confirmar gera o lançamento; rejeitar descarta sem afetar seu saldo (dá pra reconsiderar depois).</p>
      </div>
      <ReconciliationTabs
        pendingPledges={pendingPledges}
        recentRejectedPledges={recentRejectedPledges}
        archivedPledges={archivedPledges}
        accounts={activeAccounts}
        profileId={profile!.id}
        budgetCategoriesByHighlight={budgetCategoriesByHighlight}
      />
    </div>
  )
}
