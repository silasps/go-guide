'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase/client'
import { compressImage } from '@/lib/media/compress'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { Loader2, CheckCircle, Upload } from 'lucide-react'
import { PledgePaymentMethod } from '@/types/database'
import { toMasked, fromMasked, CURRENCIES } from '@/lib/currency-mask'
import { PaymentMethodInstructions } from './payment-method-instructions'
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
  onBecomePartner?: () => void
}

export function PledgeForm({ profileId, missionaryName, highlightId, highlightTitle, isRecurring, defaultCurrency, paymentOptions, onBecomePartner }: Props) {
  const t = useTranslations('PledgeForm')
  const [done, setDone] = useState(false)
  const [saving, setSaving] = useState(false)
  const [amount, setAmount] = useState('')
  const [optionId, setOptionId] = useState(paymentOptions[0]?.id ?? 'other')
  const [otherDescription, setOtherDescription] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [isAnonymous, setIsAnonymous] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [proofFile, setProofFile] = useState<File | null>(null)
  const [proofPreview, setProofPreview] = useState('')

  const [freeCurrency, setFreeCurrency] = useState(defaultCurrency)
  const selectedOption = paymentOptions.find(o => o.id === optionId)
  const method = selectedOption?.method ?? 'other'
  const isConfigured = !!selectedOption?.value.trim()
  const currency = isConfigured ? selectedOption!.currency : freeCurrency

  async function handleProofSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const compressed = await compressImage(file)
    setProofFile(compressed)
    setProofPreview(URL.createObjectURL(compressed))
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const parsedAmount = parseFloat(fromMasked(amount, currency))
    if (!parsedAmount || parsedAmount <= 0) { toast.error(t('errorAmount')); return }
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

  if (done) {
    return (
      <div className="space-y-3">
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
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {isRecurring ? t('titleRecurring') : t('title', { highlightTitle: highlightTitle ? ` — ${highlightTitle}` : '' })}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-xs text-muted-foreground -mt-2">
            {t('intro', { name: missionaryName })}
          </p>

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
                otherDescription={otherDescription}
                onOtherDescriptionChange={setOtherDescription}
              />
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                {t('amountLabelPlain')} *
                {isConfigured ? (
                  <span className="text-muted-foreground font-normal">({currency})</span>
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
              <Input inputMode="numeric" value={amount} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAmount(toMasked(e.target.value, currency))} placeholder="0,00" required />
            </div>
            <div className="space-y-2">
              <Label>{t('dateLabel')}</Label>
              <Input type="date" value={date} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDate(e.target.value)} />
            </div>
          </div>

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

          <Button type="submit" variant="support" className="w-full" disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('submit')}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
