'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase/client'
import { usePendingAction } from '@/hooks/use-pending-action'
import { PaymentMethod, FinancialAccount } from '@/types/database'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Loader2, Zap } from 'lucide-react'

interface Props {
  // Só é montado (ver PaymentMethodsList) quando a conexão já existe —
  // conectar do zero mora em PaymentMethodForm/showStripeOption. Continua
  // aceitando null só pra não quebrar o tipo em outros pontos de chamada.
  stripeMethod: PaymentMethod | null
  financialAccounts: FinancialAccount[]
}

export function StripeConnectCard({ stripeMethod, financialAccounts }: Props) {
  const t = useTranslations('PaymentMethods')
  const router = useRouter()
  const searchParams = useSearchParams()
  const { isPending: disconnecting, run: runDisconnect } = usePendingAction()
  const { isPending: savingAccount, run: runSaveAccount } = usePendingAction()
  // Otimista, não amarrado a stripeMethod.linked_account_id (prop do
  // servidor) — sem isso o <select> ficava "preso" na opção antiga até o
  // router.refresh() completar, dando sensação de travamento ao trocar de
  // conta (reportado pelo usuário testando em produção).
  const [linkedAccountId, setLinkedAccountId] = useState(stripeMethod?.linked_account_id ?? '')

  const pending = stripeMethod !== null && !stripeMethod.is_active
  // `stripe_disabled_reason` é gravado pelo webhook `account.updated`
  // (ver src/app/api/stripe/webhook/route.ts) sempre que a Stripe
  // restringe a conta depois do onboarding já ter sido concluído — estado
  // distinto de `pending` (que nunca chegou a terminar o onboarding).
  const needsAttention = stripeMethod !== null && stripeMethod.is_active && !!stripeMethod.stripe_disabled_reason

  useEffect(() => {
    const status = searchParams.get('stripe')
    if (!status) return
    const toastByStatus: Record<string, () => void> = {
      connected: () => toast.success(t('stripeToastConnected')),
      incomplete: () => toast.info(t('stripeToastIncomplete')),
      country_required: () => toast.error(t('stripeToastCountryRequired')),
      not_configured: () => toast.error(t('stripeToastNotConfigured')),
      error: () => toast.error(t('stripeToastError')),
    }
    toastByStatus[status]?.()
    const params = new URLSearchParams(searchParams)
    params.delete('stripe')
    router.replace(`/dashboard/configuracoes?${params.toString()}`)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleLinkedAccountChange(accountId: string) {
    if (!stripeMethod) return
    const previous = linkedAccountId
    setLinkedAccountId(accountId)
    runSaveAccount(true, async () => {
      const supabase = createClient()
      const { error } = await supabase.from('payment_methods').update({ linked_account_id: accountId }).eq('id', stripeMethod.id)
      if (error) { toast.error(t('errorSave')); setLinkedAccountId(previous); return }
      router.refresh()
    })
  }

  // Cobrança via Stripe já é confirmação automática (API) — sempre lança no
  // financeiro, sem opção de "só registrar a oferta" (essa faz sentido pra
  // métodos manuais como Pix, não aqui).
  useEffect(() => {
    if (stripeMethod && !pending && !stripeMethod.linked_account_id && financialAccounts.length > 0) {
      handleLinkedAccountChange(financialAccounts[0].id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stripeMethod?.id, stripeMethod?.linked_account_id, financialAccounts.length])

  function handleDisconnect() {
    if (!confirm(t('stripeConfirmDisconnect'))) return
    runDisconnect(true, async () => {
      const res = await fetch('/api/stripe/connect/disconnect', { method: 'POST' })
      if (!res.ok) { toast.error(t('errorSave')); return }
      toast.success(t('stripeDisconnected'))
      router.refresh()
    })
  }

  return (
    <Card>
      <CardContent className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Zap className="h-4 w-4 shrink-0 text-muted-foreground" />
            <p className="font-medium text-sm">{t('stripeTitle')}</p>
          </div>
          <Badge variant={needsAttention ? 'destructive' : pending ? 'outline' : 'secondary'}>
            {needsAttention ? t('stripeNeedsAttention') : pending ? t('stripePending') : t('stripeConnected')}
          </Badge>
        </div>

        {needsAttention && (
          <>
            <p className="text-xs text-muted-foreground">{t('stripeNeedsAttentionHint')}</p>
            <a href="/api/stripe/connect/start">
              <Button size="sm" variant="destructive" className="gap-2">
                <Zap className="h-4 w-4" />
                {t('stripeResolveOnStripe')}
              </Button>
            </a>
          </>
        )}

        {pending ? (
          <>
            <p className="text-xs text-muted-foreground">{t('stripePendingHint')}</p>
            <a href="/api/stripe/connect/start">
              <Button size="sm" className="gap-2">
                <Zap className="h-4 w-4" />
                {t('stripeContinueOnboarding')}
              </Button>
            </a>
          </>
        ) : (
          <>
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">{t('stripeLinkedAccountLabel')}</label>
              {financialAccounts.length > 0 ? (
                <>
                  <div className="relative">
                    <select
                      value={linkedAccountId}
                      onChange={(e) => handleLinkedAccountChange(e.target.value)}
                      disabled={savingAccount}
                      className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 pr-8 text-sm outline-none focus-visible:border-ring"
                    >
                      {financialAccounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                    {savingAccount && <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                  </div>
                  <p className="text-xs text-muted-foreground">{t('stripeLinkedAccountHint')}</p>
                </>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {t('stripeLinkedAccountEmpty')}{' '}
                  <Link href="/dashboard/financeiro/contas" className="underline">
                    {t('stripeLinkedAccountEmptyLink')}
                  </Link>
                </p>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={handleDisconnect} disabled={disconnecting}>
              {disconnecting && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              {t('stripeDisconnect')}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  )
}
