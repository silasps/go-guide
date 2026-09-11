'use client'

import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase/client'
import { usePendingAction } from '@/hooks/use-pending-action'
import { PledgePaymentMethod } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PhoneInput } from '@/components/ui/phone-input'
import { Card, CardContent } from '@/components/ui/card'
import { CheckoutHeader } from './checkout-header'
import { AccountUpsellCard } from './account-upsell-card'
import { toast } from 'sonner'
import { Loader2, CheckCircle } from 'lucide-react'
import { toMasked, fromMasked, CURRENCIES, MIN_STRIPE_AMOUNT } from '@/lib/currency-mask'
import { formatCurrency } from '@/lib/utils'
import { PaymentMethodInstructions } from './payment-method-instructions'
import { BudgetCategorySelect, type BudgetCategoryOption } from './budget-category-select'
import { AmountChips } from './amount-chips'
import { DurationChips } from './duration-chips'
import { PaymentMethodCards } from './payment-method-cards'
import { CurrencySelect } from './currency-select'
import { DonationSummary } from './donation-summary'
import { DonationHero } from './donation-hero'

type PaymentOption = { id: string; method: PledgePaymentMethod; label: string; value: string; details: string | null; currency: string }

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
  currency: string
  paymentOptions: PaymentOption[]
  stripeAvailable: boolean
  heroImageUrl?: string | null
  heroImagePosition?: string
  backHref: string
  user: SessionUser | null
  highlightId?: string
  budgetCategories?: BudgetCategoryOption[]
  initialCategoryId?: string | null
  whatsappGroupUrl?: string | null
}

export function RecurringPledgeForm({ profileId, username, missionaryName, currency: projectCurrency, paymentOptions, stripeAvailable, heroImageUrl = null, heroImagePosition, backHref, user, highlightId, budgetCategories, initialCategoryId, whatsappGroupUrl }: Props) {
  const t = useTranslations('RecurringPledge')
  const tPledge = useTranslations('PledgeForm')
  const searchParams = useSearchParams()
  // Assinatura automática via Cartão exige conta no servidor
  // (checkout-recurring/route.ts responde 401 sem usuário autenticado) —
  // diferente do avulso (checkout-once), essa é uma limitação real, não só
  // de UI. Convidado só vê métodos manuais.
  const canUseStripe = stripeAvailable && !!user
  // Volta do Stripe Checkout é reload completo (window.location.href em
  // handleStripeCheckout), então nenhum state local sobrevive — só o
  // `stripe=success` do success_url (checkout-recurring/route.ts) revela
  // que o pagamento terminou. Sem isso, essa tela reaparecia em branco
  // depois de pagar (reportado pelo usuário testando).
  const [doneViaStripe] = useState(() => searchParams.get('stripe') === 'success')
  const [done, setDone] = useState(doneViaStripe)
  const [redirectSeconds, setRedirectSeconds] = useState(50)
  const [amount, setAmount] = useState('')
  const [durationMonths, setDurationMonths] = useState<number | null>(null)
  const [categoryId, setCategoryId] = useState<string | null>(initialCategoryId ?? null)
  const [optionId, setOptionId] = useState(canUseStripe ? 'stripe' : (paymentOptions[0]?.id ?? 'other'))
  const [reminderOptIn, setReminderOptIn] = useState(true)
  const [contactPhone, setContactPhone] = useState(user?.phone ?? '')
  const [whatsappOptIn, setWhatsappOptIn] = useState(user?.whatsappOptIn ?? false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const amountInputRef = useRef<HTMLInputElement>(null)
  const doneRef = useRef<HTMLDivElement>(null)
  const { isPending: startingCheckout, run: runCheckout } = usePendingAction()
  const { isPending: savingManual, run: runManual } = usePendingAction()

  // Mesma lógica de PledgeForm/ScheduledPledgeForm: dentro do modal, a tela
  // de "pronto" troca de lugar com o formulário no mesmo container rolável
  // — sem isso, a rolagem de quem preencheu o formulário até o fim persiste
  // e a tela de sucesso aparece cortada/deslocada em vez de começar do topo.
  useEffect(() => {
    if (done) doneRef.current?.scrollIntoView({ block: 'start' })
  }, [done])

  // Redireciona pro perfil do missionário 20s depois de concluir — mesmo
  // padrão do PledgeForm (avulso). window.location.href, não router.push:
  // esta tela às vezes está dentro do modal de "Seja Parceiro"
  // (PartnershipModal, intercepting route) — navegação client-side não
  // fecha o modal, o reload completo garante que não fica sobreposto.
  useEffect(() => {
    if (!done) return
    if (redirectSeconds <= 0) {
      window.location.href = `/${username}`
      return
    }
    const timer = setTimeout(() => setRedirectSeconds((s) => s - 1), 1000)
    return () => clearTimeout(timer)
  }, [done, redirectSeconds, username])

  // Igual ao PledgeForm (avulso): checkout-recurring/route.ts já monta a
  // subscription com price_data dinâmico, então Cartão aceita qualquer
  // moeda — não fica preso à moeda padrão do projeto. O grid mostra todos
  // os métodos juntos (não só os da moeda selecionada) — a moeda funciona
  // nos dois sentidos: dropdown troca o método se ele não servir mais
  // (handleCurrencyChange), e escolher um método atualiza a moeda
  // (handleOptionSelect). Dropdown mostra a lista completa quando Stripe
  // está conectado.
  const [selectedCurrency, setSelectedCurrency] = useState(projectCurrency)
  const allOptions: PaymentOption[] = canUseStripe
    ? [{ id: 'stripe', method: 'stripe', label: t('cardTab'), value: '', details: null, currency: projectCurrency }, ...paymentOptions]
    : paymentOptions
  const dropdownCurrencies = canUseStripe
    ? CURRENCIES
    : (paymentOptions.length > 0 ? Array.from(new Set(paymentOptions.map(o => o.currency))) : [projectCurrency])
  const selectedOption = allOptions.find(o => o.id === optionId)
  const method = selectedOption?.method ?? 'other'
  const isStripe = method === 'stripe'
  const parsedAmountPreview = parseFloat(fromMasked(amount, selectedCurrency))
  const amountFormatted = amount && !isNaN(parsedAmountPreview) ? formatCurrency(parsedAmountPreview, selectedCurrency) : ''

  function handleCurrencyChange(next: string) {
    setSelectedCurrency(next)
    const stillValid = allOptions.some(o => o.id === optionId && (o.method === 'stripe' || o.currency === next))
    if (!stillValid) {
      const fallback = canUseStripe ? 'stripe' : allOptions.find(o => o.currency === next)?.id
      if (fallback) setOptionId(fallback)
    }
  }

  // Sentido inverso: escolher um método manual de outra moeda troca a
  // moeda selecionada pra dele. Cartão não força troca (aceita a moeda
  // já selecionada).
  function handleOptionSelect(id: string) {
    setOptionId(id)
    const option = allOptions.find(o => o.id === id)
    if (option && option.method !== 'stripe' && option.currency !== selectedCurrency) {
      setSelectedCurrency(option.currency)
    }
  }

  // Aponta pro perfil (não direto pro /parceria) — ResumePartnership é quem
  // completa a navegação até o wizard, de dentro da árvore de rotas certa
  // pro modal reabrir (ver comentário lá).
  const redirectParam = encodeURIComponent(`/${username}?resumeChoice=financial_ongoing${highlightId ? `&resumeHighlightId=${highlightId}` : ''}`)

  // Convidado sem nenhum método manual (o missionário só aceita Cartão, que
  // exige conta) não tem formulário nenhum pra preencher aqui — só a nota +
  // a oferta de conta.
  if (!user && paymentOptions.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <CheckoutHeader backHref={backHref} title={t('title', { name: missionaryName })} />
        <div className="mx-auto max-w-md px-4 pt-[72px] pb-8 space-y-4">
          <DonationHero imageUrl={heroImageUrl} alt={missionaryName} objectPosition={heroImagePosition} />
          <p className="text-sm text-muted-foreground">{t('guestOnlyManualNote', { name: missionaryName })}</p>
          <AccountUpsellCard missionaryName={missionaryName} redirectParam={redirectParam} whatsappGroupUrl={whatsappGroupUrl} />
        </div>
      </div>
    )
  }

  if (done) {
    return (
      <div ref={doneRef} className="min-h-screen bg-background">
        <CheckoutHeader showBack={false} />
        <div className="mx-auto max-w-md px-4 pt-[72px] pb-8 space-y-3">
          <Card>
            <CardContent className="py-12 text-center space-y-3">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto" />
              <h2 className="text-xl font-semibold">{t('doneTitle')}</h2>
              <p className="text-muted-foreground text-sm">{t('doneDescription', { name: missionaryName })}</p>
              <p className="text-xs text-muted-foreground">{tPledge('redirectingIn', { seconds: redirectSeconds })}</p>
            </CardContent>
          </Card>
          <Button type="button" variant="outline" className="w-full" onClick={() => { window.location.href = `/${username}` }}>
            {tPledge('viewProfileCta', { name: missionaryName })}
          </Button>
        </div>
      </div>
    )
  }

  function handleStripeCheckout() {
    const parsedAmount = parseFloat(fromMasked(amount, selectedCurrency))
    if (!parsedAmount || parsedAmount <= 0) { toast.error(t('errorAmount')); amountInputRef.current?.focus(); return }
    // Só vale pra cartão (Stripe cobra taxa fixa por transação) — Pix e
    // outros métodos manuais não têm mínimo (pedido direto do usuário).
    if (parsedAmount < MIN_STRIPE_AMOUNT) { toast.error(t('errorMinimumStripe', { amount: formatCurrency(MIN_STRIPE_AMOUNT, selectedCurrency) })); amountInputRef.current?.focus(); return }
    runCheckout(true, async () => {
      const res = await fetch('/api/stripe/checkout-recurring', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId, amount: parsedAmount, currency: selectedCurrency, highlightId, budgetCategoryId: categoryId, durationMonths }),
      })
      const data = await res.json()
      if (!res.ok || !data.url) { toast.error(t('errorCheckout')); return }
      window.location.href = data.url
    })
  }

  function handleManualSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const parsedAmount = parseFloat(fromMasked(amount, selectedCurrency))
    if (!parsedAmount || parsedAmount <= 0) { toast.error(t('errorAmount')); amountInputRef.current?.focus(); return }

    // Telefone só chega ao missionário com autorização explícita (checkbox)
    // — sem ela, a parceria segue sem esse dado, mesmo que a pessoa já
    // tenha digitado algo no campo.
    const authorizedPhone = whatsappOptIn && contactPhone.trim() ? contactPhone.trim() : null

    if (!user) {
      if (!name.trim()) { toast.error(t('errorName')); return }
      if (!email.trim()) { toast.error(t('errorEmail')); return }

      runManual(true, async () => {
        const supabase = createClient()
        // Convidado sem conta: sem linha em `partners` (mesma simplificação
        // de ScheduledPledgeForm/pledges) — recorrência mensal precisa de
        // e-mail de verdade pro lembrete funcionar, por isso obrigatório
        // aqui (diferente do agendamento único, que aceita só WhatsApp).
        const nextReminderAt = reminderOptIn
          ? new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString().slice(0, 10)
          : null
        const { error } = await supabase.from('recurring_pledges').insert({
          profile_id: profileId,
          partner_id: null,
          reporter_user_id: null,
          reporter_name: name.trim(),
          reporter_email: email.trim(),
          reporter_phone: authorizedPhone,
          amount: parsedAmount,
          currency: selectedCurrency,
          payment_method: method,
          highlight_id: highlightId ?? null,
          budget_category_id: highlightId ? categoryId : null,
          reminder_opt_in: reminderOptIn,
          next_reminder_at: nextReminderAt,
          status: 'active',
          duration_months: durationMonths,
        })

        if (error) { console.error('recurring_pledges insert failed (guest):', error); toast.error(t('errorSave')); return }
        setDone(true)
      })
      return
    }

    const currentUser = user

    runManual(true, async () => {
      const supabase = createClient()

      let partnerId: string
      const { data: existingPartner } = await supabase.from('partners').select('id').eq('profile_id', profileId).eq('user_id', currentUser.id).maybeSingle()
      if (existingPartner) {
        partnerId = existingPartner.id
        if (authorizedPhone) await supabase.from('partners').update({ phone: authorizedPhone }).eq('id', partnerId)
      } else {
        const { data: createdPartner, error: partnerError } = await supabase.from('partners').insert({
          profile_id: profileId,
          user_id: currentUser.id,
          name: currentUser.user_metadata?.full_name || currentUser.email?.split('@')[0] || 'Parceiro',
          email: currentUser.email,
          phone: authorizedPhone,
          // Puxa da conta (preenchida no cadastro ou via Google) pra que o
          // missionário já receba o lembrete de aniversário sem precisar
          // cadastrar a data manualmente de novo.
          birth_date: currentUser.birthDate || null,
          type: 'financial',
        }).select('id').single()
        if (partnerError || !createdPartner) { console.error('partners insert failed:', partnerError); toast.error(t('errorSave')); return }
        partnerId = createdPartner.id
      }

      // Guarda na própria conta também, pra não pedir de novo numa próxima
      // parceria com outro missionário.
      if (authorizedPhone) {
        await supabase.from('profiles').update({ phone: authorizedPhone, whatsapp_contact_opt_in: true }).eq('user_id', currentUser.id)
      }

      const nextReminderAt = reminderOptIn
        ? new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString().slice(0, 10)
        : null

      const { error } = await supabase.from('recurring_pledges').insert({
        profile_id: profileId,
        partner_id: partnerId,
        reporter_user_id: currentUser.id,
        amount: parsedAmount,
        currency: selectedCurrency,
        payment_method: method,
        highlight_id: highlightId ?? null,
        budget_category_id: highlightId ? categoryId : null,
        reminder_opt_in: reminderOptIn,
        next_reminder_at: nextReminderAt,
        status: 'active',
        duration_months: durationMonths,
      })

      if (error) { console.error('recurring_pledges insert failed:', error); toast.error(t('errorSave')); return }
      setDone(true)
    })
  }

  return (
    <div className="min-h-screen bg-background">
      <CheckoutHeader backHref={backHref} title={t('title', { name: missionaryName })} />

      <div className="mx-auto max-w-md px-4 pt-[72px] pb-28 space-y-4">
        <DonationHero imageUrl={heroImageUrl} alt={missionaryName} objectPosition={heroImagePosition} />

        {user ? (
          <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
            {t('linkingAs', { email: user.email ?? '', name: missionaryName })}
          </p>
        ) : (
          <AccountUpsellCard missionaryName={missionaryName} redirectParam={redirectParam} whatsappGroupUrl={whatsappGroupUrl} />
        )}

        <DonationSummary amountFormatted={amountFormatted} label={t('summaryLabel', { name: missionaryName })} />

        {highlightId && budgetCategories && budgetCategories.length > 0 && (
          <BudgetCategorySelect
            categories={budgetCategories}
            value={categoryId}
            onChange={setCategoryId}
            currency={projectCurrency}
            fieldLabel={tPledge('whereToInvestLabel')}
            generalLabel={tPledge('whereToInvestGeneral')}
            missingLabel={(amount) => tPledge('missingAmount', { amount })}
          />
        )}

        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <Label>{t('amountLabelPlain')} *</Label>
            <CurrencySelect currencies={dropdownCurrencies} value={selectedCurrency} onChange={handleCurrencyChange} searchPlaceholder={tPledge('currencySearchPlaceholder')} />
          </div>
          <AmountChips currency={selectedCurrency} selectedMasked={amount} onSelect={setAmount} />
          <Input ref={amountInputRef} inputMode="numeric" value={amount} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAmount(toMasked(e.target.value, selectedCurrency))} placeholder={tPledge('customAmountPlaceholder')} required />
        </div>

        <div className="space-y-2">
          <Label>{t('durationLabel')}</Label>
          <DurationChips value={durationMonths} onSelect={setDurationMonths} />
          {durationMonths != null && (
            <p className="text-xs text-muted-foreground">{t('durationHint', { count: durationMonths })}</p>
          )}
        </div>

        <div className="space-y-3 border-t border-border pt-4">
          <h2 className="text-sm font-semibold">{tPledge('sectionPaymentTitle')}</h2>
          {allOptions.length > 0 ? (
            <PaymentMethodCards options={allOptions} value={optionId} onChange={handleOptionSelect} />
          ) : (
            <p className="text-xs text-muted-foreground italic">{tPledge('noMethodsAvailable')}</p>
          )}

          {isStripe ? (
            <p className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">{tPledge('stripeInlineNote')}</p>
          ) : selectedOption && (
            <PaymentMethodInstructions
              method={selectedOption.method}
              label={selectedOption.label}
              value={selectedOption.value}
              details={selectedOption.details}
              missionaryName={missionaryName}
            />
          )}

          {!isStripe && (
            <form id="recurring-manual-form" onSubmit={handleManualSubmit} className="space-y-4">
              <p className="text-xs text-muted-foreground">{t('manualDescription')}</p>

              {!user && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>{t('nameLabel')} *</Label>
                    <Input value={name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)} placeholder={t('namePlaceholder')} required />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('emailLabel')} *</Label>
                    <Input type="email" value={email} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)} placeholder={t('emailPlaceholder')} required />
                  </div>
                </div>
              )}

              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={reminderOptIn} onChange={(e) => setReminderOptIn(e.target.checked)} className="rounded border-input" />
                {t('reminderOptInLabel')}
              </label>

              <div className="space-y-2 pt-2 border-t">
                {!user?.phone && (
                  <PhoneInput defaultValue={contactPhone} onChange={setContactPhone} placeholder={t('phonePlaceholder')} />
                )}
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={whatsappOptIn}
                    onChange={(e) => setWhatsappOptIn(e.target.checked)}
                    disabled={!user?.phone && !contactPhone.trim()}
                    className="rounded border-input"
                  />
                  {user?.phone
                    ? t('whatsappOptInLabelWithPhone', { name: missionaryName, phone: user.phone })
                    : t('whatsappOptInLabel', { name: missionaryName })}
                </label>
              </div>
            </form>
          )}
        </div>
      </div>

      <footer className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background">
        <div className="mx-auto max-w-md p-4 pb-[calc(env(safe-area-inset-bottom)+16px)]">
          {isStripe ? (
            <Button type="button" variant="support" className="w-full" onClick={handleStripeCheckout} disabled={startingCheckout}>
              {startingCheckout && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('stripeCta')}
            </Button>
          ) : (
            <Button type="submit" form="recurring-manual-form" variant="support" className="w-full" disabled={savingManual}>
              {savingManual && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('manualSubmit')}
            </Button>
          )}
        </div>
      </footer>
    </div>
  )
}
