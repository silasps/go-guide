import { createClient } from '@/lib/supabase/server'
import { getActiveProfile } from '@/lib/profile/active-profile'
import { FinancialDashboard } from '@/components/financial/financial-dashboard'
import { NewTransactionButton } from '@/components/financial/new-transaction-button'
import { Card, CardContent } from '@/components/ui/card'
import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Plus } from 'lucide-react'
import { resolveBudgetCategoryLabel } from '@/lib/highlights/budget-category-labels'

export default async function FinanceiroPage() {
  const supabase = await createClient()
  const [profile, { data: accounts }] = await Promise.all([
    getActiveProfile(),
    supabase.from('financial_accounts').select('*').order('created_at', { ascending: true }),
  ])

  // Janela ampla o bastante pra cobrir os 6 meses pra trás que o navegador
  // de mês (Saldo Previsto, ver 7.19) mostra + os 12 meses do TrendChart —
  // sem limite superior, pra não cortar transações lançadas com data futura
  // (ver `buildFinancialTimeline`, que já lida com isso corretamente). Com
  // join de categoria/parceiro (2026-09-02, ver 7.20) — o painel de
  // Lançamentos da Visão Geral usa a mesma `TransactionTable` de
  // `/lancamentos`, que espera essas relações já embutidas.
  const windowStart = new Date()
  windowStart.setDate(1)
  windowStart.setMonth(windowStart.getMonth() - 12)
  windowStart.setHours(0, 0, 0, 0)

  const [{ data: windowTransactions }, { data: categories }, { data: partners }, { data: highlights }] = await Promise.all([
    supabase.from('transactions')
      .select('*, category:transaction_categories!transactions_category_id_fkey(*), partner:partners(name)')
      .eq('profile_id', profile!.id)
      .gte('date', windowStart.toISOString().slice(0, 10)),
    supabase.from('transaction_categories').select('*').eq('profile_id', profile!.id),
    supabase.from('partners').select('*').eq('profile_id', profile!.id).order('name'),
    supabase.from('highlights').select('id, title').eq('profile_id', profile!.id).order('title'),
  ])

  const highlightIds = (highlights ?? []).map((h) => h.id)
  const { data: budgetCategories } = highlightIds.length > 0
    ? await supabase.from('project_budget_categories').select('*').in('highlight_id', highlightIds)
    : { data: [] }
  const highlightsWithBudget = (highlights ?? []).map((h) => ({
    id: h.id,
    title: h.title,
    budgetCategories: (budgetCategories ?? [])
      .filter((c) => c.highlight_id === h.id)
      .map((c) => ({ id: c.id, label: resolveBudgetCategoryLabel(c) })),
  }))

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
      <div className="flex items-center justify-end">
        <NewTransactionButton accounts={accounts} categories={categories ?? []} partners={partners ?? []} highlights={highlightsWithBudget} />
      </div>

      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <FinancialDashboard accounts={accounts} transactions={(windowTransactions ?? []) as any} categories={categories ?? []} partners={partners ?? []} highlights={highlightsWithBudget} />
    </div>
  )
}
