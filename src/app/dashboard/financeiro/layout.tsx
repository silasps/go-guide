import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { FinanceSubNav } from '@/components/financial/finance-sub-nav'

export default async function FinanceiroLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Financeiro</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Contas, lançamentos e conciliação de ofertas</p>
      </div>
      <FinanceSubNav />
      {children}
    </div>
  )
}
