import { createClient } from '@/lib/supabase/server'
import { getActiveProfile } from '@/lib/profile/active-profile'
import { SpendingLimitsList } from '@/components/financial/spending-limits-list'
import { NewSpendingLimitButton } from '@/components/financial/new-spending-limit-button'

export default async function LimitesPage() {
  const supabase = await createClient()
  const profile = await getActiveProfile()

  const monthStart = new Date()
  monthStart.setDate(1)
  const monthStartStr = monthStart.toISOString().slice(0, 10)

  const [{ data: accounts }, { data: categories }, { data: limits }, { data: monthExpenses }] = await Promise.all([
    supabase.from('financial_accounts').select('*').order('created_at'),
    supabase.from('transaction_categories').select('*').eq('profile_id', profile!.id).order('name'),
    supabase.from('spending_limits').select('*').eq('profile_id', profile!.id).order('created_at'),
    supabase.from('transactions').select('category_id, amount').eq('profile_id', profile!.id).eq('type', 'expense').gte('date', monthStartStr),
  ])

  const currencies = [...new Set((accounts ?? []).map((a) => a.currency_code))]
  const spentByCategory: Record<string, number> = {}
  for (const t of monthExpenses ?? []) {
    if (!t.category_id) continue
    spentByCategory[t.category_id] = (spentByCategory[t.category_id] ?? 0) + t.amount
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <p className="text-sm text-muted-foreground">Teto mensal de despesa por categoria, com aviso quando estourar.</p>
        <NewSpendingLimitButton profileId={profile!.id} categories={categories ?? []} currencies={currencies} usedCategoryIds={(limits ?? []).map((l) => l.category_id)} />
      </div>
      <SpendingLimitsList limits={limits ?? []} categories={categories ?? []} spentByCategory={spentByCategory} profileId={profile!.id} currencies={currencies} />
    </div>
  )
}
