import { createClient } from '@/lib/supabase/server'
import { getActiveProfile } from '@/lib/profile/active-profile'
import { ReportsAnalytics } from '@/components/financial/reports-analytics'

// Aba "Relatórios" — analytics do mês (Despesas/Receitas por Categoria +
// Gráficos de frequência), estilo GranaZen (ver 7.24). Diferente de
// "Prestações" (histórico de prestação de contas publicada, que morava
// nesta rota antes) — nomes coincidiam no GranaZen mas eram conceitos
// diferentes, por isso a antiga virou /dashboard/financeiro/prestacoes.
export default async function RelatoriosPage() {
  const supabase = await createClient()
  const profile = await getActiveProfile()

  const windowStart = new Date()
  windowStart.setDate(1)
  windowStart.setMonth(windowStart.getMonth() - 12)
  windowStart.setHours(0, 0, 0, 0)

  const [{ data: accounts }, { data: windowTransactions }, { data: categories }] = await Promise.all([
    supabase.from('financial_accounts').select('*').order('created_at', { ascending: true }),
    supabase.from('transactions').select('*').eq('profile_id', profile!.id).gte('date', windowStart.toISOString().slice(0, 10)),
    supabase.from('transaction_categories').select('*').eq('profile_id', profile!.id),
  ])
  // Moedas/saldo atual do relatório vêm só de contas ativas (ver 7.29) —
  // uma conta arquivada não deveria inflar o "saldo atual" nem oferecer
  // moeda pro filtro.
  const activeAccounts = (accounts ?? []).filter((a) => !a.archived)

  return <ReportsAnalytics accounts={activeAccounts} transactions={windowTransactions ?? []} categories={categories ?? []} />
}
