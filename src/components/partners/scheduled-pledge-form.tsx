'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase/client'
import { usePendingAction } from '@/hooks/use-pending-action'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { CheckoutHeader } from './checkout-header'
import { NeedsAccountCard } from './needs-account-card'
import { DonationHero } from './donation-hero'
import { toast } from 'sonner'
import { Loader2, CalendarClock } from 'lucide-react'
import { toMasked, fromMasked } from '@/lib/currency-mask'

interface SessionUser {
  id: string
  email: string | null
  user_metadata?: { full_name?: string }
  phone?: string | null
  whatsappOptIn?: boolean
  birthDate?: string | null
}

interface Props {
  profileId: string
  missionaryName: string
  currency: string
  heroImageUrl?: string | null
  heroImagePosition?: string
  backHref: string
  user: SessionUser | null
  returnPath: string
  highlightId?: string
}

function tomorrow() {
  return new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

/** "Quero ajudar, mas não agora" — agenda um lembrete pra uma doação
 *  avulsa futura, sem coletar valor nem forma de pagamento agora (isso só
 *  é pedido de verdade quando a pessoa volta pelo link do lembrete, direto
 *  no PledgeForm). Não é recorrente — pra isso já existe "Ser parceiro
 *  fixo" (RecurringPledgeForm). Ver cron scheduled-pledge-reminders. */
export function ScheduledPledgeForm({ profileId, missionaryName, currency, heroImageUrl = null, heroImagePosition, backHref, user, returnPath, highlightId }: Props) {
  const t = useTranslations('ScheduledPledge')
  const [done, setDone] = useState(false)
  const [date, setDate] = useState(tomorrow())
  const [amount, setAmount] = useState('')
  const { isPending: saving, run } = usePendingAction()

  const redirectParam = encodeURIComponent(`${returnPath}${returnPath.includes('?') ? '&' : '?'}choice=financial_scheduled`)

  if (!user) {
    return (
      <NeedsAccountCard
        backHref={backHref}
        redirectParam={redirectParam}
        title={t('needsAccountTitle')}
        description={t('needsAccountDescription')}
        createAccountLabel={t('createAccount')}
        alreadyHaveAccountLabel={t('alreadyHaveAccount')}
      />
    )
  }

  if (done) {
    return (
      <div className="min-h-screen bg-background">
        <CheckoutHeader backHref={backHref} />
        <div className="mx-auto flex min-h-[calc(100vh-56px)] max-w-md flex-col justify-center px-4 pb-8">
          <Card>
            <CardContent className="py-12 text-center space-y-3">
              <CalendarClock className="h-12 w-12 text-support mx-auto" />
              <h2 className="text-xl font-semibold">{t('doneTitle')}</h2>
              <p className="text-muted-foreground text-sm">
                {t('doneDescription', { name: missionaryName, date: new Date(`${date}T00:00:00`).toLocaleDateString('pt-BR') })}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const currentUser = user
    if (!currentUser) return
    const parsedAmount = amount ? parseFloat(fromMasked(amount, currency)) : null

    run(true, async () => {
      const supabase = createClient()

      // Mesmo bloco de find-or-create de RecurringPledgeForm — todo caminho
      // financeiro (imediato, recorrente ou agendado) alimenta o mesmo CRM
      // de parceiros do missionário.
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
          phone: currentUser.phone || null,
          birth_date: currentUser.birthDate || null,
          type: 'financial',
        }).select('id').single()
        if (partnerError || !createdPartner) { console.error('partners insert failed:', partnerError); toast.error(t('errorSave')); return }
        partnerId = createdPartner.id
      }

      const { error } = await supabase.from('scheduled_pledges').insert({
        profile_id: profileId,
        partner_id: partnerId,
        reporter_user_id: currentUser.id,
        amount: parsedAmount && parsedAmount > 0 ? parsedAmount : null,
        currency: parsedAmount && parsedAmount > 0 ? currency : null,
        highlight_id: highlightId ?? null,
        scheduled_date: date,
        status: 'pending',
      })

      if (error) { console.error('scheduled_pledges insert failed:', error); toast.error(t('errorSave')); return }
      setDone(true)
    })
  }

  return (
    <div className="min-h-screen bg-background">
      <CheckoutHeader backHref={backHref} title={t('title', { name: missionaryName })} />

      <div className="mx-auto max-w-md px-4 pt-[72px] pb-28 space-y-4">
        <DonationHero imageUrl={heroImageUrl} alt={missionaryName} objectPosition={heroImagePosition} />

        <p className="text-sm text-muted-foreground">{t('intro', { name: missionaryName })}</p>

        <form id="scheduled-pledge-form" onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>{t('dateLabel')} *</Label>
            <Input type="date" value={date} min={tomorrow()} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDate(e.target.value)} required />
          </div>

          <div className="space-y-2">
            <Label>{t('amountLabel', { currency })} <span className="text-muted-foreground font-normal">{t('amountOptional')}</span></Label>
            <Input inputMode="numeric" value={amount} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAmount(toMasked(e.target.value, currency))} placeholder={t('amountPlaceholder')} />
          </div>

          <p className="text-xs text-muted-foreground">{t('note')}</p>
        </form>
      </div>

      <footer className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background">
        <div className="mx-auto max-w-md p-4 pb-[calc(env(safe-area-inset-bottom)+16px)]">
          <Button type="submit" form="scheduled-pledge-form" variant="support" className="w-full" disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('submit')}
          </Button>
        </div>
      </footer>
    </div>
  )
}
