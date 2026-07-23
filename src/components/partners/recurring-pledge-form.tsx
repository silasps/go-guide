'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase/client'
import { usePendingAction } from '@/hooks/use-pending-action'
import { PledgePaymentMethod } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { Loader2, CheckCircle } from 'lucide-react'
import { toMasked, fromMasked, CURRENCIES } from '@/lib/currency-mask'
import { PaymentMethodInstructions } from './payment-method-instructions'

type PaymentOption = { id: string; method: PledgePaymentMethod; label: string; value: string; details: string | null; currency: string }

interface SessionUser {
  id: string
  email: string | null
  user_metadata?: { full_name?: string }
}

interface Props {
  profileId: string
  missionaryName: string
  currency: string
  paymentOptions: PaymentOption[]
  stripeAvailable: boolean
  user: SessionUser | null
  returnPath: string // caminho atual (com highlight_id se houver), usado no redirect de login/cadastro
  highlightId?: string
}

export function RecurringPledgeForm({ profileId, missionaryName, currency, paymentOptions, stripeAvailable, user, returnPath, highlightId }: Props) {
  const t = useTranslations('RecurringPledge')
  const [done, setDone] = useState(false)
  const [showManual, setShowManual] = useState(!stripeAvailable)
  const [amount, setAmount] = useState('')
  const [optionId, setOptionId] = useState(paymentOptions[0]?.id ?? 'other')
  const [reminderOptIn, setReminderOptIn] = useState(true)
  const { isPending: startingCheckout, run: runCheckout } = usePendingAction()
  const { isPending: savingManual, run: runManual } = usePendingAction()

  const [freeCurrency, setFreeCurrency] = useState(currency)
  const selectedOption = paymentOptions.find(o => o.id === optionId)
  const method = selectedOption?.method ?? 'other'
  const isManualConfigured = !!selectedOption?.value.trim()
  const activeCurrency = showManual ? (isManualConfigured ? selectedOption!.currency : freeCurrency) : currency

  const redirectParam = encodeURIComponent(`${returnPath}${returnPath.includes('?') ? '&' : '?'}choice=financial_ongoing`)

  if (!user) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('needsAccountTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">{t('needsAccountDescription')}</p>
          <Link href={`/cadastro?redirect=${redirectParam}`}>
            <Button className="w-full">{t('createAccount')}</Button>
          </Link>
          <Link href={`/login?redirect=${redirectParam}`}>
            <Button variant="outline" className="w-full">{t('alreadyHaveAccount')}</Button>
          </Link>
        </CardContent>
      </Card>
    )
  }

  if (done) {
    return (
      <Card>
        <CardContent className="py-12 text-center space-y-3">
          <CheckCircle className="h-12 w-12 text-green-500 mx-auto" />
          <h2 className="text-xl font-semibold">{t('doneTitle')}</h2>
          <p className="text-muted-foreground text-sm">{t('doneDescription', { name: missionaryName })}</p>
        </CardContent>
      </Card>
    )
  }

  function handleStripeCheckout() {
    const parsedAmount = parseFloat(fromMasked(amount, activeCurrency))
    if (!parsedAmount || parsedAmount <= 0) { toast.error(t('errorAmount')); return }
    runCheckout(true, async () => {
      const res = await fetch('/api/stripe/checkout-recurring', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId, amount: parsedAmount, currency, highlightId }),
      })
      const data = await res.json()
      if (!res.ok || !data.url) { toast.error(t('errorCheckout')); return }
      window.location.href = data.url
    })
  }

  function handleManualSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const parsedAmount = parseFloat(fromMasked(amount, activeCurrency))
    if (!parsedAmount || parsedAmount <= 0) { toast.error(t('errorAmount')); return }
    const currentUser = user
    if (!currentUser) return

    runManual(true, async () => {
      const supabase = createClient()

      let partnerId: string
      const { data: existingPartner } = await supabase.from('partners').select('id').eq('profile_id', profileId).eq('user_id', currentUser.id).maybeSingle()
      if (existingPartner) {
        partnerId = existingPartner.id
      } else {
        const { data: createdPartner, error: partnerError } = await supabase.from('partners').insert({
          profile_id: profileId,
          user_id: currentUser.id,
          name: currentUser.user_metadata?.full_name || currentUser.email?.split('@')[0] || 'Parceiro',
          email: currentUser.email,
          type: 'financial',
        }).select('id').single()
        if (partnerError || !createdPartner) { toast.error(t('errorSave')); return }
        partnerId = createdPartner.id
      }

      const nextReminderAt = reminderOptIn
        ? new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString().slice(0, 10)
        : null

      const { error } = await supabase.from('recurring_pledges').insert({
        profile_id: profileId,
        partner_id: partnerId,
        reporter_user_id: currentUser.id,
        amount: parsedAmount,
        currency: activeCurrency,
        payment_method: method,
        highlight_id: highlightId ?? null,
        reminder_opt_in: reminderOptIn,
        next_reminder_at: nextReminderAt,
        status: 'active',
      })

      if (error) { toast.error(t('errorSave')); return }
      setDone(true)
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('title', { name: missionaryName })}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
          {t('linkingAs', { email: user.email ?? '', name: missionaryName })}
        </p>
        <div className="space-y-2">
          <Label className="flex items-center gap-1.5">
            {t('amountLabelPlain')} *
            {(!showManual || isManualConfigured) ? (
              <span className="text-muted-foreground font-normal">({activeCurrency})</span>
            ) : (
              <select
                value={freeCurrency}
                onChange={(e) => setFreeCurrency(e.target.value)}
                className="h-5 rounded border border-input bg-transparent px-1 text-xs font-normal outline-none focus-visible:border-ring"
              >
                {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            )}
          </Label>
          <Input inputMode="numeric" value={amount} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAmount(toMasked(e.target.value, activeCurrency))} placeholder="0,00" required />
        </div>

        {stripeAvailable && !showManual && (
          <div className="space-y-2">
            <Button type="button" variant="support" className="w-full" onClick={handleStripeCheckout} disabled={startingCheckout}>
              {startingCheckout && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('stripeCta')}
            </Button>
            <button type="button" onClick={() => setShowManual(true)} className="w-full text-center text-xs text-muted-foreground hover:text-foreground">
              {t('preferManual')}
            </button>
          </div>
        )}

        {showManual && (
          <form onSubmit={handleManualSubmit} className="space-y-4 pt-1 border-t">
            <p className="text-xs text-muted-foreground pt-3">{t('manualDescription')}</p>
            <div className="space-y-2">
              <Label>{t('methodLabel')}</Label>
              <select
                value={optionId}
                onChange={(e) => { setOptionId(e.target.value); setAmount('') }}
                className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring"
              >
                {paymentOptions.map(opt => (
                  <option key={opt.id} value={opt.id}>{opt.label}{opt.value.trim() ? ` (${opt.currency})` : ''}</option>
                ))}
              </select>
              {selectedOption && (
                <PaymentMethodInstructions
                  method={selectedOption.method}
                  label={selectedOption.label}
                  value={selectedOption.value}
                  details={selectedOption.details}
                  missionaryName={missionaryName}
                />
              )}
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={reminderOptIn} onChange={(e) => setReminderOptIn(e.target.checked)} className="rounded border-input" />
              {t('reminderOptInLabel')}
            </label>
            <Button type="submit" variant="support" className="w-full" disabled={savingManual}>
              {savingManual && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('manualSubmit')}
            </Button>
            {stripeAvailable && (
              <button type="button" onClick={() => setShowManual(false)} className="w-full text-center text-xs text-muted-foreground hover:text-foreground">
                {t('preferStripe')}
              </button>
            )}
          </form>
        )}
      </CardContent>
    </Card>
  )
}
