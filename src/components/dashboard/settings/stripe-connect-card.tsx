'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase/client'
import { usePendingAction } from '@/hooks/use-pending-action'
import { PaymentMethod, FinancialAccount } from '@/types/database'
import { STRIPE_CONNECT_COUNTRIES } from '@/lib/stripe/connect-countries'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Loader2, ShieldCheck, Zap } from 'lucide-react'

interface Props {
  stripeMethod: PaymentMethod | null
  financialAccounts: FinancialAccount[]
}

export function StripeConnectCard({ stripeMethod, financialAccounts }: Props) {
  const t = useTranslations('PaymentMethods')
  const locale = useLocale()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [country, setCountry] = useState('')
  const { isPending: disconnecting, run: runDisconnect } = usePendingAction()
  const { isPending: savingAccount, run: runSaveAccount } = usePendingAction()

  const pending = stripeMethod !== null && !stripeMethod.is_active

  const countryOptions = STRIPE_CONNECT_COUNTRIES
    .map(code => ({ code, name: new Intl.DisplayNames([locale], { type: 'region' }).of(code) ?? code }))
    .sort((a, b) => a.name.localeCompare(b.name, locale))

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
    runSaveAccount(true, async () => {
      const supabase = createClient()
      const { error } = await supabase.from('payment_methods').update({ linked_account_id: accountId || null }).eq('id', stripeMethod.id)
      if (error) { toast.error(t('errorSave')); return }
      router.refresh()
    })
  }

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
            <div>
              <p className="font-medium text-sm">{t('stripeTitle')}</p>
              <p className="text-xs text-muted-foreground">{t('stripeDescription')}</p>
            </div>
          </div>
          {stripeMethod && (
            <Badge variant={pending ? 'outline' : 'secondary'}>
              {pending ? t('stripePending') : t('stripeConnected')}
            </Badge>
          )}
        </div>

        {stripeMethod && !pending ? (
          <>
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">{t('stripeLinkedAccountLabel')}</label>
              <select
                value={stripeMethod.linked_account_id ?? ''}
                onChange={(e) => handleLinkedAccountChange(e.target.value)}
                disabled={savingAccount}
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring"
              >
                <option value="">{t('stripeLinkedAccountNone')}</option>
                {financialAccounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
              <p className="text-xs text-muted-foreground">{t('stripeLinkedAccountHint')}</p>
            </div>
            <Button variant="outline" size="sm" onClick={handleDisconnect} disabled={disconnecting}>
              {disconnecting && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              {t('stripeDisconnect')}
            </Button>
          </>
        ) : (
          <>
            {pending && <p className="text-xs text-muted-foreground">{t('stripePendingHint')}</p>}
            {!pending && (
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">{t('stripeCountryLabel')}</label>
                <select
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring"
                >
                  <option value="">{t('stripeCountryPlaceholder')}</option>
                  {countryOptions.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                </select>
              </div>
            )}
            <a href={pending ? '/api/stripe/connect/start' : (country ? `/api/stripe/connect/start?country=${country}` : undefined)}>
              <Button size="sm" className="gap-2" disabled={!pending && !country}>
                <Zap className="h-4 w-4" />
                {pending ? t('stripeContinueOnboarding') : t('stripeConnect')}
              </Button>
            </a>
            <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              {t('stripeSecurityNote')}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  )
}
