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
import { CurrencySelect } from './currency-select'
import { AmountChips } from './amount-chips'
import { toast } from 'sonner'
import { Loader2, CalendarClock } from 'lucide-react'
import { toMasked, fromMasked, CURRENCIES } from '@/lib/currency-mask'
import { PledgePaymentMethod } from '@/types/database'

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
  username: string
  missionaryName: string
  defaultCurrency: string
  paymentOptions: { id: string; method: PledgePaymentMethod; label: string; value: string; details: string | null; currency: string }[]
  stripeAvailable?: boolean
  heroImageUrl?: string | null
  heroImagePosition?: string
  backHref: string
  user: SessionUser | null
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
export function ScheduledPledgeForm({ profileId, username, missionaryName, defaultCurrency, paymentOptions, stripeAvailable = false, heroImageUrl = null, heroImagePosition, backHref, user, highlightId }: Props) {
  const t = useTranslations('ScheduledPledge')
  const [done, setDone] = useState(false)
  const [date, setDate] = useState(tomorrow())
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState(defaultCurrency)
  const { isPending: saving, run } = usePendingAction()

  // Mesma regra de PledgeForm: com Stripe conectado, qualquer moeda
  // suportada vale (price_data dinâmico); sem Stripe, só as moedas que o
  // missionário já tem forma de receber.
  const dropdownCurrencies = stripeAvailable
    ? CURRENCIES
    : (paymentOptions.length > 0 ? Array.from(new Set(paymentOptions.map(o => o.currency))) : CURRENCIES)

  // Aponta pro perfil (não direto pro /parceria) — ResumePartnership é quem
  // completa a navegação até o wizard, de dentro da árvore de rotas certa
  // pro modal reabrir (ver comentário lá).
  const redirectParam = encodeURIComponent(`/${username}?resumeChoice=financial_scheduled${highlightId ? `&resumeHighlightId=${highlightId}` : ''}`)

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
        <CheckoutHeader showBack={false} />
        <div className="mx-auto max-w-md px-4 pt-[72px] pb-8 space-y-3">
          <Card>
            <CardContent className="py-12 text-center space-y-3">
              <CalendarClock className="h-12 w-12 text-support mx-auto" />
              <h2 className="text-xl font-semibold">{t('doneTitle')}</h2>
              <p className="text-muted-foreground text-sm">
                {t('doneDescription', { name: missionaryName, date: new Date(`${date}T00:00:00`).toLocaleDateString('pt-BR') })}
              </p>
            </CardContent>
          </Card>
          {/* Sem seta de "voltar" fazendo esse papel — CheckoutHeader.backHref
              usa router.back(), que pode devolver pra qualquer tela do meio
              do fluxo (login/cadastro, formulário). Esse botão é a única
              saída clara e garantida de volta pro perfil. */}
          <Button type="button" variant="outline" className="w-full" onClick={() => { window.location.href = `/${username}` }}>
            {t('viewProfileCta', { name: missionaryName })}
          </Button>
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
            <div className="flex items-center gap-1.5">
              <Label>{t('amountLabelPlain')} <span className="text-muted-foreground font-normal">{t('amountOptional')}</span></Label>
              <CurrencySelect currencies={dropdownCurrencies} value={currency} onChange={setCurrency} searchPlaceholder={t('currencySearchPlaceholder')} />
            </div>
            <AmountChips currency={currency} selectedMasked={amount} onSelect={setAmount} />
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
