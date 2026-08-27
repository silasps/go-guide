'use client'

import { useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase/client'
import { compressImage } from '@/lib/media/compress'
import { usePendingAction } from '@/hooks/use-pending-action'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { CheckoutHeader } from './checkout-header'
import { toast } from 'sonner'
import { Loader2, CheckCircle, Upload } from 'lucide-react'
import { PledgePaymentMethod } from '@/types/database'
import { toMasked, fromMasked, CURRENCIES } from '@/lib/currency-mask'
import { PaymentMethodInstructions } from './payment-method-instructions'
import { BudgetCategorySelect, type BudgetCategoryOption } from './budget-category-select'
import { AmountChips } from './amount-chips'
import { PaymentMethodCards } from './payment-method-cards'
import { DonationSummary } from './donation-summary'
import { DonationHero } from './donation-hero'
import { formatCurrency } from '@/lib/utils'
import Image from 'next/image'

type PaymentOption = { id: string; method: PledgePaymentMethod; label: string; value: string; details: string | null; currency: string }

interface Props {
  profileId: string
  missionaryName: string
  highlightId?: string
  highlightTitle?: string
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

export function PledgeForm({ profileId, missionaryName, highlightId, highlightTitle, isRecurring, defaultCurrency, paymentOptions, stripeAvailable = false, heroImageUrl = null, heroImagePosition, budgetCategories, initialCategoryId, backHref, onBecomePartner }: Props) {
  const t = useTranslations('PledgeForm')
  const [done, setDone] = useState(false)
  const [saving, setSaving] = useState(false)
  const { isPending: startingCheckout, run: runCheckout } = usePendingAction()
  const [amount, setAmount] = useState('')
  const [categoryId, setCategoryId] = useState<string | null>(initialCategoryId ?? null)
  const [optionId, setOptionId] = useState(stripeAvailable ? 'stripe' : (paymentOptions[0]?.id ?? 'other'))
  const [otherDescription, setOtherDescription] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [isAnonymous, setIsAnonymous] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [proofFile, setProofFile] = useState<File | null>(null)
  const [proofPreview, setProofPreview] = useState('')
  const amountInputRef = useRef<HTMLInputElement>(null)

  const [currency, setCurrency] = useState(defaultCurrency)
  // Cartão (Stripe) entra como mais uma opção no mesmo grid de mini-cards,
  // não numa aba separada — mesma seleção pra todos os métodos, cada um
  // revela seu próprio jeito de continuar (Stripe: botão de checkout; Pix
  // etc.: instruções + formulário de autorregistro).
  const allOptions: PaymentOption[] = stripeAvailable
    ? [{ id: 'stripe', method: 'stripe', label: t('cardTab'), value: '', details: null, currency: defaultCurrency }, ...paymentOptions]
    : paymentOptions
  // A moeda escolhida decide quais métodos fazem sentido mostrar — uma
  // chave Pix cadastrada em BRL não serve pra quem quer mandar USD, por
  // exemplo. Cartão processa qualquer moeda (Stripe), sempre aparece.
  const visibleOptions = allOptions.filter(o => o.method === 'stripe' || o.currency === currency)
  // Dropdown de moeda reflete o que foi cadastrado em Configurações >
  // Pagamentos — se só existe recebimento em BRL, só BRL aparece pra
  // escolher (em vez da lista fixa de moedas suportadas). Cartão aceita
  // qualquer uma das moedas suportadas (price_data dinâmico no Stripe),
  // então com Stripe conectado a lista completa fica disponível.
  const dropdownCurrencies = stripeAvailable
    ? CURRENCIES
    : (paymentOptions.length > 0 ? Array.from(new Set(paymentOptions.map(o => o.currency))) : CURRENCIES)
  const selectedOption = visibleOptions.find(o => o.id === optionId)
  const method = selectedOption?.method ?? 'other'
  const isStripe = method === 'stripe'
  const parsedAmountPreview = parseFloat(fromMasked(amount, currency))
  const amountFormatted = amount && !isNaN(parsedAmountPreview) ? formatCurrency(parsedAmountPreview, currency) : ''

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

    const { error } = await supabase.from('pledges').insert({
      highlight_id: isRecurring ? null : (highlightId ?? null),
      budget_category_id: isRecurring ? null : (highlightId ? categoryId : null),
      profile_id: profileId,
      reporter_user_id: user?.id ?? null,
      reporter_name: isAnonymous ? null : name.trim(),
      reporter_email: isAnonymous ? null : (email.trim() || user?.email || null),
      is_anonymous: isAnonymous,
      message: fullMessage,
      reported_amount: parsedAmount,
      currency,
      payment_method: method,
      reported_at: new Date(date).toISOString(),
      proof_url,
      is_recurring_pledge: isRecurring,
    })

    setSaving(false)
    if (error) { toast.error(t('errorSave')); return }
    setDone(true)
  }

  const title = isRecurring ? t('titleRecurring') : t('title', { highlightTitle: highlightTitle ? ` — ${highlightTitle}` : '' })

  if (done) {
    return (
      <div className="min-h-screen bg-background">
        <CheckoutHeader backHref={backHref} />
        <div className="mx-auto flex min-h-[calc(100vh-56px)] max-w-md flex-col justify-center px-4 pb-8 space-y-3">
          <Card>
            <CardContent className="py-12 text-center space-y-3">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto" />
              <h2 className="text-xl font-semibold">{t('doneTitle')}</h2>
              <p className="text-muted-foreground text-sm">{t('doneDescription', { name: missionaryName })}</p>
            </CardContent>
          </Card>
          {!isRecurring && onBecomePartner && (
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="py-6 text-center space-y-3">
                <p className="text-sm">{t('becomePartnerPrompt', { name: missionaryName })}</p>
                <Button type="button" variant="outline" className="w-full" onClick={onBecomePartner}>
                  {t('becomePartnerCta')}
                </Button>
              </CardContent>
            </Card>
          )}
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
          <Label className="flex items-center gap-1.5">
            {t('amountLabelPlain')} *
            <select
              value={currency}
              onChange={(e) => handleCurrencyChange(e.target.value)}
              className="h-5 rounded border border-input bg-transparent px-1 text-xs font-normal outline-none focus-visible:border-ring"
            >
              {dropdownCurrencies.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </Label>
          <AmountChips currency={currency} selectedMasked={amount} onSelect={setAmount} />
          <Input ref={amountInputRef} inputMode="numeric" value={amount} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAmount(toMasked(e.target.value, currency))} placeholder={t('customAmountPlaceholder')} required />
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
            </>
          )}

          <div className="space-y-2">
            <Label>{t('messageLabel', { name: missionaryName })}</Label>
            <Textarea value={message} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setMessage(e.target.value)} placeholder={t('messagePlaceholder')} rows={2} />
          </div>
        </div>

        <div className="space-y-3 border-t border-border pt-4">
          <h2 className="text-sm font-semibold">{t('sectionPaymentTitle')}</h2>
          {visibleOptions.length > 0 ? (
            <PaymentMethodCards options={visibleOptions} value={optionId} onChange={setOptionId} />
          ) : (
            <p className="text-xs text-muted-foreground italic">{t('noMethodsForCurrency', { currency })}</p>
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
