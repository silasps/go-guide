'use client'

import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase/client'
import { compressImage } from '@/lib/media/compress'
import { usePendingAction } from '@/hooks/use-pending-action'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { PhoneInput } from '@/components/ui/phone-input'
import { Card, CardContent } from '@/components/ui/card'
import { CheckoutHeader } from './checkout-header'
import { toast } from 'sonner'
import { Loader2, CheckCircle, Upload } from 'lucide-react'
import { PledgePaymentMethod } from '@/types/database'
import { toMasked, fromMasked, CURRENCIES } from '@/lib/currency-mask'
import { PaymentMethodInstructions } from './payment-method-instructions'
import { BudgetCategorySelect, type BudgetCategoryOption } from './budget-category-select'
import { AmountChips, type RemainingOption } from './amount-chips'
import { PaymentMethodCards } from './payment-method-cards'
import { CurrencySelect } from './currency-select'
import { DonationSummary } from './donation-summary'
import { DonationHero } from './donation-hero'
import { formatCurrency } from '@/lib/utils'
import Image from 'next/image'

type PaymentOption = { id: string; method: PledgePaymentMethod; label: string; value: string; details: string | null; currency: string }

interface Props {
  profileId: string
  username: string
  missionaryName: string
  highlightId?: string
  highlightTitle?: string
  highlightGoalAmount?: number | null
  highlightCurrentAmount?: number | null
  isRecurring: boolean
  defaultCurrency: string
  paymentOptions: PaymentOption[]
  stripeAvailable?: boolean
  heroImageUrl?: string | null
  heroImagePosition?: string
  budgetCategories?: BudgetCategoryOption[]
  initialCategoryId?: string | null
  backHref: string
  onBecomePartner?: () => void
}

export function PledgeForm({ profileId, username, missionaryName, highlightId, highlightTitle, highlightGoalAmount, highlightCurrentAmount, isRecurring, defaultCurrency, paymentOptions, stripeAvailable = false, heroImageUrl = null, heroImagePosition, budgetCategories, initialCategoryId, backHref, onBecomePartner }: Props) {
  const t = useTranslations('PledgeForm')
  const searchParams = useSearchParams()
  // Volta do Stripe Checkout é um reload completo (window.location.href),
  // então nenhum state local sobrevive — o único jeito de saber que o
  // pagamento foi concluído é o `stripe=success` que o success_url embute
  // (ver checkout-once/route.ts), já presente na primeira renderização (não
  // precisa de efeito pra isso). Não dá pra saber aqui se foi anônimo/com
  // nome (isso ficou só no Stripe Checkout), por isso a tela de "pronto"
  // usa uma mensagem própria pra esse caminho (doneDescriptionStripe).
  const [doneViaStripe] = useState(() => searchParams.get('stripe') === 'success')
  const [done, setDone] = useState(doneViaStripe)
  const [doneAsLoggedIn, setDoneAsLoggedIn] = useState(false)
  const [redirectSeconds, setRedirectSeconds] = useState(20)
  const doneRef = useRef<HTMLDivElement>(null)
  const [saving, setSaving] = useState(false)
  const { isPending: startingCheckout, run: runCheckout } = usePendingAction()
  // Chegando pelo lembrete de uma oferta agendada (scheduled_pledges — ver
  // cron scheduled-pledge-reminders), valor/moeda vêm pré-preenchidos da
  // URL em vez de começar em branco. toMasked espera dígitos "como se
  // tivessem sido digitados" (últimos 2 = centavos), não um número
  // decimal pronto — por isso a conversão pra centavos antes.
  const [amount, setAmount] = useState(() => {
    const prefill = searchParams.get('amount')
    if (!prefill) return ''
    const cents = Math.round(parseFloat(prefill) * 100)
    return isNaN(cents) ? '' : toMasked(String(cents), searchParams.get('currency') || defaultCurrency)
  })
  const [categoryId, setCategoryId] = useState<string | null>(initialCategoryId ?? null)
  const [optionId, setOptionId] = useState(stripeAvailable ? 'stripe' : (paymentOptions[0]?.id ?? 'other'))
  const [otherDescription, setOtherDescription] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [isAnonymous, setIsAnonymous] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [message, setMessage] = useState('')
  const [proofFile, setProofFile] = useState<File | null>(null)
  const [proofPreview, setProofPreview] = useState('')
  const amountInputRef = useRef<HTMLInputElement>(null)

  // Redireciona pro perfil do missionário 8s depois de concluir, a menos
  // que a pessoa já tenha saído da tela (ex.: clicou em "quero ser parceiro
  // fixo", que desmonta este componente) — o cleanup abaixo cobre isso.
  // window.location.href (não router.push): esta tela às vezes está dentro
  // do modal de "Seja Parceiro" (PartnershipModal, intercepting route) —
  // uma navegação client-side pro perfil não fecha esse modal (ele só some
  // quando a rota interceptada deixa de casar via navegação de verdade), o
  // reload completo garante que a tela final não fica com o modal por cima.
  useEffect(() => {
    if (!done) return
    if (redirectSeconds <= 0) {
      window.location.href = `/${username}`
      return
    }
    const timer = setTimeout(() => setRedirectSeconds((s) => s - 1), 1000)
    return () => clearTimeout(timer)
  }, [done, redirectSeconds, username])

  // Dentro do modal (PartnershipModal), a tela de "pronto" troca de lugar
  // com o formulário no mesmo container rolável (`overflow-y-auto` em
  // partnership-modal.tsx) — sem isso, se a pessoa tiver rolado pra baixo
  // pra preencher o formulário, essa rolagem persiste e a tela de sucesso
  // aparece cortada/deslocada em vez de começar do topo.
  useEffect(() => {
    if (done) doneRef.current?.scrollIntoView({ block: 'start' })
  }, [done])

  const [currency, setCurrency] = useState(() => searchParams.get('currency') || defaultCurrency)
  // Cartão (Stripe) entra como mais uma opção no mesmo grid de mini-cards,
  // não numa aba separada — mesma seleção pra todos os métodos, cada um
  // revela seu próprio jeito de continuar (Stripe: botão de checkout; Pix
  // etc.: instruções + formulário de autorregistro).
  const allOptions: PaymentOption[] = stripeAvailable
    ? [{ id: 'stripe', method: 'stripe', label: t('cardTab'), value: '', details: null, currency: defaultCurrency }, ...paymentOptions]
    : paymentOptions
  // O grid mostra todos os métodos juntos, não só os da moeda selecionada
  // — assim dá pra clicar direto num método de outra moeda (ver
  // handleOptionSelect) em vez de precisar trocar a moeda primeiro. A
  // moeda funciona nos dois sentidos: escolher no dropdown ainda troca o
  // método selecionado se ele não servir mais pra essa moeda
  // (handleCurrencyChange), e escolher um método atualiza a moeda.
  // Dropdown de moeda reflete o que foi cadastrado em Configurações >
  // Pagamentos — se só existe recebimento em BRL, só BRL aparece pra
  // escolher (em vez da lista fixa de moedas suportadas). Cartão aceita
  // qualquer uma das moedas suportadas (price_data dinâmico no Stripe),
  // então com Stripe conectado a lista completa fica disponível.
  const dropdownCurrencies = stripeAvailable
    ? CURRENCIES
    : (paymentOptions.length > 0 ? Array.from(new Set(paymentOptions.map(o => o.currency))) : CURRENCIES)
  const selectedOption = allOptions.find(o => o.id === optionId)
  const method = selectedOption?.method ?? 'other'
  const isStripe = method === 'stripe'
  const parsedAmountPreview = parseFloat(fromMasked(amount, currency))
  const amountFormatted = amount && !isNaN(parsedAmountPreview) ? formatCurrency(parsedAmountPreview, currency) : ''

  // Chip "cobrir tudo/o que falta": só faz sentido na moeda em que a meta
  // (do projeto ou da etapa escolhida) foi cadastrada — trocar de moeda no
  // seletor de valor esconde o chip em vez de mostrar um número que não
  // bate com a meta de verdade.
  const selectedCategory = categoryId ? budgetCategories?.find(c => c.id === categoryId) : null
  const remainingSource = currency === defaultCurrency
    ? selectedCategory
      ? { amount: Math.max(0, selectedCategory.target_amount - selectedCategory.raised_amount), isFull: selectedCategory.raised_amount <= 0 }
      : highlightId && highlightGoalAmount != null
        ? { amount: Math.max(0, highlightGoalAmount - (highlightCurrentAmount ?? 0)), isFull: (highlightCurrentAmount ?? 0) <= 0 }
        : null
    : null
  const remainingOption: RemainingOption | null = remainingSource
    ? {
        amount: remainingSource.amount,
        label: remainingSource.isFull
          ? t('coverFullLabel', { amount: formatCurrency(remainingSource.amount, currency) })
          : t('coverRemainingLabel', { amount: formatCurrency(remainingSource.amount, currency) }),
      }
    : null

  function handleCurrencyChange(next: string) {
    setCurrency(next)
    // Se o método selecionado não serve mais pra essa moeda, troca pro
    // primeiro que servir (Cartão em primeiro lugar, se disponível).
    const stillValid = allOptions.some(o => o.id === optionId && (o.method === 'stripe' || o.currency === next))
    if (!stillValid) {
      const fallback = stripeAvailable ? 'stripe' : allOptions.find(o => o.currency === next)?.id
      if (fallback) setOptionId(fallback)
    }
  }

  // Sentido inverso do handleCurrencyChange: escolher um método manual
  // (Pix, transferência etc.) de outra moeda troca a moeda selecionada
  // pra dele — sincronização nos dois sentidos. Cartão (Stripe) não força
  // troca, já que aceita a moeda que já estiver selecionada.
  function handleOptionSelect(id: string) {
    setOptionId(id)
    const option = allOptions.find(o => o.id === id)
    if (option && option.method !== 'stripe' && option.currency !== currency) {
      setCurrency(option.currency)
    }
  }

  async function handleProofSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const compressed = await compressImage(file)
    setProofFile(compressed)
    setProofPreview(URL.createObjectURL(compressed))
  }

  function handleStripeCheckout() {
    const parsedAmount = parseFloat(fromMasked(amount, currency))
    if (!parsedAmount || parsedAmount <= 0) { toast.error(t('errorAmount')); amountInputRef.current?.focus(); return }
    if (!isAnonymous && !name.trim()) { toast.error(t('errorName')); return }
    runCheckout(true, async () => {
      const res = await fetch('/api/stripe/checkout-once', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profileId,
          amount: parsedAmount,
          currency,
          highlightId,
          budgetCategoryId: categoryId ?? undefined,
          isAnonymous,
          name: isAnonymous ? undefined : name.trim(),
          email: isAnonymous ? undefined : email.trim(),
          message: message.trim(),
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.url) { toast.error(t('errorCheckout')); return }
      window.location.href = data.url
    })
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const parsedAmount = parseFloat(fromMasked(amount, currency))
    if (!parsedAmount || parsedAmount <= 0) { toast.error(t('errorAmount')); amountInputRef.current?.focus(); return }
    if (!isAnonymous && !name.trim()) { toast.error(t('errorName')); return }
    setSaving(true)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    let proof_url: string | null = null
    if (proofFile && user) {
      const path = `${user.id}/pledges/${crypto.randomUUID()}.webp`
      const { error: uploadError } = await supabase.storage.from('media').upload(path, proofFile)
      if (!uploadError) proof_url = supabase.storage.from('media').getPublicUrl(path).data.publicUrl
    }

    const fullMessage = [
      method === 'other' && otherDescription.trim() ? `${t('otherPrefix')}: ${otherDescription.trim()}` : null,
      message.trim() || null,
    ].filter(Boolean).join('\n\n') || null

    // Id gerado no cliente (em vez de várias-select().single() depois do
    // insert) porque a policy de SELECT de pledges só libera pro dono do
    // perfil ou pro próprio reporter logado — um guest anônimo/identificado
    // sem conta nunca conseguiria ler a linha de volta via RETURNING, o que
    // faria o insert (bem-sucedido) aparentar erro no cliente.
    const scheduledPledgeId = searchParams.get('scheduled')
    const pledgeId = crypto.randomUUID()
    const { error } = await supabase.from('pledges').insert({
      id: pledgeId,
      highlight_id: isRecurring ? null : (highlightId ?? null),
      budget_category_id: isRecurring ? null : (highlightId ? categoryId : null),
      profile_id: profileId,
      reporter_user_id: user?.id ?? null,
      reporter_name: isAnonymous ? null : name.trim(),
      reporter_email: isAnonymous ? null : (email.trim() || user?.email || null),
      reporter_phone: isAnonymous ? null : (phone.trim() || null),
      is_anonymous: isAnonymous,
      message: fullMessage,
      reported_amount: parsedAmount,
      currency,
      payment_method: method,
      reported_at: new Date(date).toISOString(),
      proof_url,
      is_recurring_pledge: isRecurring,
      scheduled_pledge_id: scheduledPledgeId || null,
    })

    setSaving(false)
    if (error) { console.error('pledges insert failed:', error); toast.error(t('errorSave')); return }
    setDoneAsLoggedIn(!!user)
    setDone(true)

    // Chegou pelo lembrete de uma oferta agendada e completou de verdade —
    // fecha o laço marcando o agendamento como cumprido (RLS já permite,
    // é o próprio reporter). Best-effort: se falhar, o agendamento só fica
    // parado em "sent" — sem tela nenhuma dependendo desse status hoje.
    if (scheduledPledgeId) {
      supabase.from('scheduled_pledges').update({ status: 'fulfilled' }).eq('id', scheduledPledgeId).then(() => {})
    }

    // Quem se identificou mas não tem conta não recebe notificação in-app —
    // manda um e-mail de confirmação pro endereço que a pessoa preencheu.
    if (!user && !isAnonymous && email.trim()) {
      fetch(`/api/pledges/${pledgeId}/notify-guest`, { method: 'POST' }).catch(() => {})
    }
  }

  const title = isRecurring ? t('titleRecurring') : t('title', { highlightTitle: highlightTitle ? ` — ${highlightTitle}` : '' })

  if (done) {
    return (
      <div ref={doneRef} className="min-h-screen bg-background">
        <CheckoutHeader backHref={backHref} />
        <div className="mx-auto max-w-md px-4 pt-[72px] pb-8 space-y-3">
          <Card>
            <CardContent className="py-12 text-center space-y-3">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto" />
              <h2 className="text-xl font-semibold">{t('doneTitle')}</h2>
              <p className="text-sm text-muted-foreground">
                <span className="text-foreground font-medium">
                  {highlightTitle
                    ? t('doneContributionProject', { project: highlightTitle, name: missionaryName })
                    : t('doneContributionGeneral', { name: missionaryName })}
                </span>{' '}
                {doneViaStripe
                  ? t('doneDescriptionStripe', { name: missionaryName })
                  : t(doneAsLoggedIn ? 'doneDescriptionNotified' : isAnonymous ? 'doneDescriptionAnonymous' : 'doneDescriptionGuestNamed', { name: missionaryName })}
              </p>
              <p className="text-xs text-muted-foreground">{t('redirectingIn', { seconds: redirectSeconds })}</p>
            </CardContent>
          </Card>
          {!isRecurring && onBecomePartner && (
            <Card className="bg-support/10 border-support/30">
              <CardContent className="py-6 text-center space-y-3">
                <p className="text-sm">{t('becomePartnerPrompt', { name: missionaryName })}</p>
                <Button type="button" variant="support" size="lg" className="w-full" onClick={onBecomePartner}>
                  {t('becomePartnerCta')}
                </Button>
                <p className="text-xs text-muted-foreground">{t('becomePartnerNote')}</p>
              </CardContent>
            </Card>
          )}
          <Button type="button" variant="outline" className="w-full" onClick={() => { window.location.href = `/${username}` }}>
            {t('viewProfileCta', { name: missionaryName })}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <CheckoutHeader backHref={backHref} title={title} />

      <div className="mx-auto max-w-md px-4 pt-[72px] pb-28 space-y-4">
        <DonationHero imageUrl={heroImageUrl} alt={highlightTitle ?? missionaryName} objectPosition={heroImagePosition} />

        <p className="text-xs text-muted-foreground">
          {t('intro', { name: missionaryName })}
        </p>

        <DonationSummary amountFormatted={amountFormatted} label={t('summaryLabel', { name: missionaryName })} />

        {highlightId && budgetCategories && budgetCategories.length > 0 && (
          <BudgetCategorySelect
            categories={budgetCategories}
            value={categoryId}
            onChange={setCategoryId}
            currency={defaultCurrency}
            fieldLabel={t('whereToInvestLabel')}
            generalLabel={t('whereToInvestGeneral')}
            missingLabel={(amount) => t('missingAmount', { amount })}
          />
        )}

        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <Label>{t('amountLabelPlain')} *</Label>
            <CurrencySelect currencies={dropdownCurrencies} value={currency} onChange={handleCurrencyChange} searchPlaceholder={t('currencySearchPlaceholder')} />
          </div>
          <AmountChips currency={currency} selectedMasked={amount} onSelect={setAmount} remaining={remainingOption} />
          <Input ref={amountInputRef} inputMode="numeric" value={amount} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAmount(toMasked(e.target.value, currency))} placeholder={t('customAmountPlaceholder')} required />
          <p className="text-xs italic text-muted-foreground">🌱 {t('sowerEncouragement')}</p>
        </div>

        <div className="space-y-3 border-t border-border pt-4">
          <h2 className="text-sm font-semibold">{t('sectionPaymentTitle')}</h2>
          {allOptions.length > 0 ? (
            <PaymentMethodCards options={allOptions} value={optionId} onChange={handleOptionSelect} />
          ) : (
            <p className="text-xs text-muted-foreground italic">{t('noMethodsAvailable')}</p>
          )}

          {isStripe ? (
            <p className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">{t('stripeInlineNote')}</p>
          ) : selectedOption && (
            <PaymentMethodInstructions
              method={selectedOption.method}
              label={selectedOption.label}
              value={selectedOption.value}
              details={selectedOption.details}
              missionaryName={missionaryName}
              otherDescription={otherDescription}
              onOtherDescriptionChange={setOtherDescription}
            />
          )}
        </div>

        <div className="space-y-4 border-t border-border pt-4">
          <h2 className="text-sm font-semibold">{t('sectionYourDataTitle')}</h2>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isAnonymous} onChange={(e) => setIsAnonymous(e.target.checked)} className="rounded border-input" />
            {t('anonymousLabel')}
          </label>

          {!isAnonymous && (
            <>
              <div className="space-y-2">
                <Label>{t('nameLabel')} *</Label>
                <Input value={name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)} placeholder={t('namePlaceholder')} required={!isAnonymous} />
              </div>
              <div className="space-y-2">
                <Label>{t('emailLabel')}</Label>
                <Input type="email" value={email} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)} placeholder={t('emailPlaceholder')} />
              </div>
              <div className="space-y-2">
                <Label>{t('phoneLabel')}</Label>
                <PhoneInput defaultValue={phone} onChange={setPhone} />
              </div>
            </>
          )}

          <div className="space-y-2">
            <Label>{t('messageLabel', { name: missionaryName })}</Label>
            <Textarea value={message} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setMessage(e.target.value)} placeholder={t('messagePlaceholder')} rows={2} />
          </div>

          {!isStripe && (
            <form id="pledge-manual-form" onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>{t('dateLabel')}</Label>
                <Input type="date" value={date} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDate(e.target.value)} />
              </div>

              <div className="space-y-2">
                <Label>{t('proofLabel')}</Label>
                {proofPreview ? (
                  <div className="relative h-32 w-full">
                    <Image src={proofPreview} alt="comprovante" fill className="object-cover rounded-lg" />
                    <label className="absolute bottom-2 right-2 cursor-pointer">
                      <div className="bg-black/60 text-white text-xs px-2 py-1 rounded-lg hover:bg-black/80 transition-colors">{t('proofChange')}</div>
                      <input type="file" accept="image/*" className="hidden" onChange={handleProofSelect} />
                    </label>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center gap-1.5 h-20 rounded-lg border border-dashed cursor-pointer text-muted-foreground hover:text-foreground transition-colors">
                    <Upload className="h-4 w-4" />
                    <span className="text-xs">{t('proofAttach')}</span>
                    <input type="file" accept="image/*" className="hidden" onChange={handleProofSelect} />
                  </label>
                )}
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
            <Button type="submit" form="pledge-manual-form" variant="support" className="w-full" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('submit')}
            </Button>
          )}
        </div>
      </footer>
    </div>
  )
}
