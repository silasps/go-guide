import { createClient } from '@/lib/supabase/server'
import { getActiveProfile } from '@/lib/profile/active-profile'
import { FinancialDashboard } from '@/components/financial/financial-dashboard'
import { TransactionTable } from '@/components/financial/transaction-table'
import { Card, CardContent } from '@/components/ui/card'
import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Plus } from 'lucide-react'

export default async function FinanceiroPage() {
  const supabase = await createClient()
  const [profile, { data: accounts }] = await Promise.all([
    getActiveProfile(),
    supabase.from('financial_accounts').select('*').order('created_at', { ascending: true }),
  ])

  const twelveMonthsAgo = new Date()
  twelveMonthsAgo.setDate(1)
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 11)
  twelveMonthsAgo.setHours(0, 0, 0, 0)

  const [{ data: yearTransactions }, { data: recent }, { data: categories }] = await Promise.all([
    supabase.from('transactions').select('*').eq('profile_id', profile!.id).gte('date', twelveMonthsAgo.toISOString().slice(0, 10)),
    supabase.from('transactions')
      .select('*, category:transaction_categories!transactions_category_id_fkey(*), partner:partners(name)')
      .eq('profile_id', profile!.id)
      .order('date', { ascending: false })
      .limit(8),
    supabase.from('transaction_categories').select('*').eq('profile_id', profile!.id),
  ])

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
      <FinancialDashboard accounts={accounts} transactions={yearTransactions ?? []} categories={categories ?? []} />

      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-sm">Últimos lançamentos</h2>
        <Link href="/dashboard/financeiro/lancamentos" className="text-sm text-primary hover:underline">Ver todos</Link>
      </div>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <TransactionTable transactions={(recent ?? []) as any} accounts={accounts} readOnly />
    </div>
  )
}
