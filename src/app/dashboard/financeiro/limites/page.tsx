import { createClient } from '@/lib/supabase/server'
import { getActiveProfile } from '@/lib/profile/active-profile'
import { SpendingLimitsTabs } from '@/components/financial/spending-limits-tabs'
import { NewSpendingLimitButton } from '@/components/financial/new-spending-limit-button'
import { MonthLimitNav } from '@/components/financial/month-limit-nav'

interface Props {
  searchParams: Promise<{ month?: string }>
}

function currentMonthStr() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export default async function LimitesPage({ searchParams }: Props) {
  const { month: monthParam } = await searchParams
  const month = monthParam && /^\d{4}-\d{2}$/.test(monthParam) ? monthParam : currentMonthStr()
  const [year, monthNum] = month.split('-').map(Number)

  const monthStart = new Date(year, monthNum - 1, 1)
  const nextMonthStart = new Date(year, monthNum, 1)
  const monthStartStr = monthStart.toISOString().slice(0, 10)
  const nextMonthStartStr = nextMonthStart.toISOString().slice(0, 10)

  const isCurrentMonth = month === currentMonthStr()
  const todayPct = isCurrentMonth ? (new Date().getDate() / new Date(year, monthNum, 0).getDate()) * 100 : null

  const label = monthStart.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  const monthLabel = label.charAt(0).toUpperCase() + label.slice(1)

  const supabase = await createClient()
  const profile = await getActiveProfile()

  const [{ data: accounts }, { data: allCategories }, { data: limits }, { data: monthExpenses }, { data: generalLimit }] = await Promise.all([
    supabase.from('financial_accounts').select('*').order('created_at'),
    supabase.from('transaction_categories').select('*').eq('profile_id', profile!.id).order('name'),
    supabase.from('spending_limits').select('*').eq('profile_id', profile!.id).order('created_at'),
    supabase.from('transactions').select('*').eq('profile_id', profile!.id).eq('type', 'expense').gte('date', monthStartStr).lt('date', nextMonthStartStr),
    supabase.from('general_spending_limits').select('*').eq('profile_id', profile!.id).maybeSingle(),
  ])

  // Só categoria de topo tem limite (UNIQUE(profile_id, category_id) na
  // migration 082, ver system.architecture.md 7.20/7.21) — subcategoria
  // nunca aparece aqui.
  const categories = (allCategories ?? []).filter((c) => !c.parent_id)

  // Só moedas de contas ativas (ver 7.29) — arquivar a única conta numa
  // moeda não deveria deixar essa moeda selecionável pra um limite novo.
  const currencies = [...new Set((accounts ?? []).filter((a) => !a.archived).map((a) => a.currency_code))]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <p className="text-sm text-muted-foreground">Acompanhe no geral ou por categoria.</p>
        <NewSpendingLimitButton profileId={profile!.id} categories={categories} currencies={currencies} usedCategoryIds={(limits ?? []).map((l) => l.category_id)} />
      </div>
      <MonthLimitNav month={month} monthLabel={monthLabel} />
      <SpendingLimitsTabs
        limits={limits ?? []}
        categories={categories}
        allCategories={allCategories ?? []}
        monthExpenses={monthExpenses ?? []}
        month={month}
        profileId={profile!.id}
        currencies={currencies}
        todayPct={todayPct}
        generalLimit={generalLimit}
        monthLabel={monthLabel}
      />
    </div>
  )
}
