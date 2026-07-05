import { createClient } from '@/lib/supabase/server'
import { getActiveProfile } from '@/lib/profile/active-profile'
import { BalanceSummary } from '@/components/financial/balance-summary'
import { TransactionTable } from '@/components/financial/transaction-table'
import { Card, CardContent } from '@/components/ui/card'
import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Plus } from 'lucide-react'

export default async function FinanceiroPage() {
  const supabase = await createClient()
  const profile = await getActiveProfile()

  const { data: accounts } = await supabase
    .from('financial_accounts')
    .select('*')
    .order('created_at', { ascending: true })

  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  const { data: monthTransactions } = await supabase
    .from('transactions')
    .select('*')
    .eq('profile_id', profile!.id)
    .gte('date', startOfMonth.toISOString().slice(0, 10))

  const { data: recent } = await supabase
    .from('transactions')
    .select('*, category:transaction_categories!transactions_category_id_fkey(*), partner:partners(name)')
    .eq('profile_id', profile!.id)
    .order('date', { ascending: false })
    .limit(8)

  if (!accounts || accounts.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center space-y-3">
          <p className="text-muted-foreground text-sm">Você ainda não tem nenhuma conta financeira.</p>
          <Link href="/dashboard/financeiro/contas" className={cn(buttonVariants(), 'gap-2')}>
            <Plus className="h-4 w-4" /> Criar minha primeira conta
          </Link>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <BalanceSummary accounts={accounts} monthTransactions={monthTransactions ?? []} />

      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-sm">Últimos lançamentos</h2>
        <Link href="/dashboard/financeiro/lancamentos" className="text-sm text-primary hover:underline">Ver todos</Link>
      </div>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <TransactionTable transactions={(recent ?? []) as any} accounts={accounts} readOnly />
    </div>
  )
}
