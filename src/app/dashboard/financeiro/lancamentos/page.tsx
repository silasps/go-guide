import { createClient } from '@/lib/supabase/server'
import { TransactionTable } from '@/components/financial/transaction-table'
import { NewTransactionButton } from '@/components/financial/new-transaction-button'
import { TransactionFilters } from '@/components/financial/transaction-filters'

interface Props {
  searchParams: Promise<{ account?: string; category?: string }>
}

export default async function LancamentosPage({ searchParams }: Props) {
  const { account, category } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('id').eq('user_id', user!.id).single()

  const { data: accounts } = await supabase.from('financial_accounts').select('*').order('created_at')
  const { data: categories } = await supabase.from('transaction_categories').select('*').eq('profile_id', profile!.id).order('name')
  const { data: partners } = await supabase.from('partners').select('*').eq('profile_id', profile!.id).order('name')
  const { data: highlights } = await supabase.from('highlights').select('id, title').eq('profile_id', profile!.id).order('title')

  let query = supabase
    .from('transactions')
    .select('*, category:transaction_categories!transactions_category_id_fkey(*), partner:partners(name)')
    .eq('profile_id', profile!.id)
    .order('date', { ascending: false })
    .limit(200)

  if (account) query = query.eq('account_id', account)
  if (category) query = query.eq('category_id', category)

  const { data: transactions } = await query

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <TransactionFilters accounts={accounts ?? []} categories={categories ?? []} />
        <NewTransactionButton accounts={accounts ?? []} categories={categories ?? []} partners={partners ?? []} highlights={highlights ?? []} />
      </div>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <TransactionTable transactions={(transactions ?? []) as any} accounts={accounts ?? []} categories={categories ?? []} partners={partners ?? []} highlights={highlights ?? []} />
    </div>
  )
}
