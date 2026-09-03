import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { getActiveProfile } from '@/lib/profile/active-profile'
import { isSuperAdmin } from '@/lib/auth/superadmin'
import { FinanceSubNav } from '@/components/financial/finance-sub-nav'
import { EmailVerificationBanner } from '@/components/dashboard/email-verification-banner'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ShieldAlert, Lock, ArrowRight } from 'lucide-react'

export default async function FinanceiroLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [profile, t] = await Promise.all([getActiveProfile(), getTranslations('FinanceGate')])

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

  // Financeiro multi-moeda é feature Pro+ (ver /planos e planLimits em
  // src/lib/utils.ts) — Free fica só com o teaser. Superadmin (ver
  // isSuperAdmin) sempre passa direto, independente de plano.
  if (profile && profile.plan === 'free' && !isSuperAdmin(user.email)) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-semibold">Financeiro</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Contas, lançamentos e conciliação de ofertas</p>
        </div>
        <div className="rounded-2xl border p-6 text-center space-y-4">
          <Lock className="h-8 w-8 text-primary mx-auto" />
          <div>
            <p className="font-semibold">{t('title')}</p>
            <p className="text-sm text-muted-foreground mt-1">{t('description')}</p>
          </div>
          <Link href="/planos" className={cn(buttonVariants(), 'gap-1.5')}>
            {t('cta')}
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
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
