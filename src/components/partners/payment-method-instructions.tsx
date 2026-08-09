'use client'

import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Copy } from 'lucide-react'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { getPaymentMethodEntry } from '@/lib/payment-methods/catalog'
import { parseBankDetails } from '@/lib/payment-methods/bank-details'
import type { PledgePaymentMethod } from '@/types/database'

interface CopyableValueProps {
  value: string
  /** Destaque visual (cor de apoio) pro método mais rápido de contribuir —
   *  hoje só o PIX usa isso, pra não sumir no meio de outras informações. */
  emphasized?: boolean
}

export function CopyableValue({ value, emphasized = false }: CopyableValueProps) {
  const t = useTranslations('PaymentInstructions')

  async function handleCopy() {
    await navigator.clipboard.writeText(value)
    toast.success(t('copied'))
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={cn(
        'flex w-full items-center gap-2 rounded-md border px-2.5 py-1.5 text-left transition-colors',
        emphasized ? 'border-support/40 bg-support/10 hover:bg-support/15' : 'border-input bg-background hover:bg-muted/50'
      )}
    >
      <span className={cn('flex-1 select-all break-all font-mono text-sm', emphasized && 'font-semibold')}>{value}</span>
      <Copy className={cn('h-3.5 w-3.5 shrink-0', emphasized ? 'text-support' : 'text-muted-foreground')} />
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
    return (
      <div className="rounded-lg border border-support/40 bg-support/10 p-3 space-y-1.5">
        <p className="text-xs font-medium text-support flex items-center gap-1.5"><Icon className="h-3.5 w-3.5" /> {t('titlePix', { name: missionaryName })}</p>
        {label && <p className="text-xs text-muted-foreground">{t('pixHolder')}: <span className="font-medium text-foreground">{label}</span></p>}
        <CopyableValue value={value} emphasized />
      </div>
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
