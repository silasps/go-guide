import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getActiveProfile } from '@/lib/profile/active-profile'
import { FinanceSubNav } from '@/components/financial/finance-sub-nav'
import { EmailVerificationBanner } from '@/components/dashboard/email-verification-banner'
import { ShieldAlert } from 'lucide-react'

export default async function FinanceiroLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const profile = await getActiveProfile()

  // Financeiro lida com recibos e avisos de repasse — únicas áreas do app onde
  // e-mail verificado é exigido de verdade (bloqueio, não só o banner
  // dispensável do resto do dashboard). Decisão do usuário: só o lado de quem
  // RECEBE (perfil ativo aqui), não o do parceiro doador (financeiro-parceiro,
  // rota separada, sem esse gate).
  if (profile && !profile.email_verified) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-semibold">Financeiro</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Contas, lançamentos e conciliação de ofertas</p>
        </div>
        <div className="rounded-2xl border p-6 text-center space-y-4">
          <ShieldAlert className="h-8 w-8 text-primary mx-auto" />
          <div>
            <p className="font-semibold">Confirme seu e-mail para acessar o Financeiro</p>
            <p className="text-sm text-muted-foreground mt-1">
              Recibos e avisos de repasse dependem de um e-mail verificado. Confirme o seu para liberar esta área.
            </p>
          </div>
          <EmailVerificationBanner />
        </div>
      </div>
    )
  }

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
