'use client'

import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Copy } from 'lucide-react'
import { Textarea } from '@/components/ui/textarea'
import { getPaymentMethodEntry } from '@/lib/payment-methods/catalog'
import { parseBankDetails } from '@/lib/payment-methods/bank-details'
import type { PledgePaymentMethod } from '@/types/database'

export function CopyableValue({ value }: { value: string }) {
  const t = useTranslations('PaymentInstructions')

  async function handleCopy() {
    await navigator.clipboard.writeText(value)
    toast.success(t('copied'))
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="flex w-full items-center gap-2 rounded-md border border-input bg-background px-2.5 py-1.5 text-left transition-colors hover:bg-muted/50"
    >
      <span className="flex-1 select-all break-all font-mono text-sm">{value}</span>
      <Copy className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
    </button>
  )
}

interface Props {
  method: PledgePaymentMethod
  label: string
  value: string
  details: string | null
  missionaryName: string
  otherDescription?: string
  onOtherDescriptionChange?: (value: string) => void
}

function isUrl(value: string) {
  return /^https?:\/\//i.test(value.trim())
}

export function PaymentMethodInstructions({ method, label, value, details, missionaryName, otherDescription, onOtherDescriptionChange }: Props) {
  const t = useTranslations('PaymentInstructions')
  const entry = getPaymentMethodEntry(method)
  const Icon = entry.icon
  const hasValue = value.trim().length > 0
  const hasDetails = !!details?.trim()

  const box = (content: React.ReactNode, title: string) => (
    <div className="rounded-lg border bg-muted/30 p-3 space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5"><Icon className="h-3.5 w-3.5" /> {title}</p>
      {content}
    </div>
  )

  if (!hasValue && !hasDetails && method !== 'other') {
    return (
      <p className="text-xs text-muted-foreground italic px-1">{t('notConfigured')}</p>
    )
  }

  if (method === 'bank_transfer') {
    const bank = parseBankDetails(details)
    return box(
      <dl className="text-sm space-y-0.5">
        {label && <div><dt className="inline text-muted-foreground">{t('bankHolder')}: </dt><dd className="inline font-medium">{label}</dd></div>}
        {hasValue && (
          <div className="space-y-1">
            <dt className="text-muted-foreground">{t('bankAccount')}:</dt>
            <dd><CopyableValue value={value} /></dd>
          </div>
        )}
        {bank.bankName && <div><dt className="inline text-muted-foreground">{t('bankName')}: </dt><dd className="inline">{bank.bankName}</dd></div>}
        {bank.swift && <div><dt className="inline text-muted-foreground">{t('bankSwift')}: </dt><dd className="inline font-mono">{bank.swift}</dd></div>}
        {bank.routingNumber && <div><dt className="inline text-muted-foreground">{t('bankRouting')}: </dt><dd className="inline font-mono">{bank.routingNumber}</dd></div>}
        {bank.bankAddress && <div><dt className="inline text-muted-foreground">{t('bankAddress')}: </dt><dd className="inline">{bank.bankAddress}</dd></div>}
      </dl>,
      t('titleBankTransfer', { name: missionaryName })
    )
  }

  if (method === 'pix') {
    return box(
      <CopyableValue value={value} />,
      t('titlePix', { name: missionaryName })
    )
  }

  if (method === 'other') {
    return (
      <div className="space-y-2">
        {(hasValue || hasDetails) && box(
          <>
            {hasValue && <CopyableValue value={value} />}
            {hasDetails && <p className="text-sm whitespace-pre-wrap">{details}</p>}
          </>,
          t('titleSuggested', { name: missionaryName })
        )}
        {onOtherDescriptionChange && (
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">{t('otherDescriptionLabel')}</label>
            <Textarea
              value={otherDescription ?? ''}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => onOtherDescriptionChange(e.target.value)}
              placeholder={t('otherDescriptionPlaceholder')}
              rows={2}
            />
          </div>
        )}
      </div>
    )
  }

  if (isUrl(value)) {
    return box(
      <a href={value} target="_blank" rel="noopener noreferrer" className="text-sm text-primary underline break-all">{t('openLink', { label })}</a>,
      t('titleGeneric', { label })
    )
  }

  return box(
    <>
      <CopyableValue value={value} />
      {hasDetails && <p className="text-xs text-muted-foreground whitespace-pre-wrap">{details}</p>}
    </>,
    t('titleGeneric', { label })
  )
}
