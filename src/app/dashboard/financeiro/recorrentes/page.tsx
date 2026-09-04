import { createClient } from '@/lib/supabase/server'
import { getActiveProfile } from '@/lib/profile/active-profile'
import { RecurringTransactionsList } from '@/components/financial/recurring-transactions-list'
import { NewRecurringTransactionButton } from '@/components/financial/new-recurring-transaction-button'

export default async function RecorrentesPage() {
  const supabase = await createClient()
  const profile = await getActiveProfile()

  const [{ data: accounts }, { data: categories }, { data: recurring }] = await Promise.all([
    supabase.from('financial_accounts').select('*').order('created_at'),
    supabase.from('transaction_categories').select('*').eq('profile_id', profile!.id).order('name'),
    supabase.from('recurring_transactions').select('*').eq('profile_id', profile!.id).order('next_due_date'),
  ])
  // Arquivada (ver 7.29) some do seletor de conta pra nova recorrência, mas
  // continua disponível pra exibir/editar recorrências já existentes nela.
  const activeAccounts = (accounts ?? []).filter((a) => !a.archived)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <p className="text-sm text-muted-foreground">Aluguel, assinaturas, mensalidades — lançados sozinhos todo mês.</p>
        <NewRecurringTransactionButton accounts={activeAccounts} categories={categories ?? []} />
      </div>
      <RecurringTransactionsList recurring={recurring ?? []} accounts={accounts ?? []} categories={categories ?? []} />
    </div>
  )
}
