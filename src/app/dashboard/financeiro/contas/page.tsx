import { createClient } from '@/lib/supabase/server'
import { getActiveProfile } from '@/lib/profile/active-profile'
import { AccountCard } from '@/components/financial/account-card'
import { AccountForm } from '@/components/financial/account-form'

export default async function ContasPage() {
  const supabase = await createClient()
  const profile = await getActiveProfile()

  const { data: accounts } = await supabase.from('financial_accounts').select('*').order('created_at')
  const accountIds = (accounts ?? []).map(a => a.id)
  const { data: members } = accountIds.length > 0
    ? await supabase.from('account_members').select('*').in('account_id', accountIds)
    : { data: [] }

  const creditAccountIds = (accounts ?? []).filter(a => a.account_type === 'credit').map(a => a.id)
  const { data: openBills } = creditAccountIds.length > 0
    ? await supabase.from('transactions').select('account_id, amount, type').in('account_id', creditAccountIds).eq('fatura_paid', false)
    : { data: [] }
  const currentBills: Record<string, number> = {}
  for (const t of openBills ?? []) {
    currentBills[t.account_id] = (currentBills[t.account_id] ?? 0) + (t.type === 'income' ? -t.amount : t.amount)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{accounts?.length ?? 0} conta(s)</p>
        <AccountForm profileId={profile!.id} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(accounts ?? []).map(a => (
          <AccountCard
            key={a.id}
            account={a}
            profileId={profile!.id}
            members={(members ?? []).filter(m => m.account_id === a.id)}
            currentBill={currentBills[a.id] ?? 0}
          />
        ))}
      </div>
    </div>
  )
}
