'use client'

import { useTranslations } from 'next-intl'
import { PaymentMethod } from '@/types/database'
import { PaymentMethodCard } from './payment-method-card'
import { PaymentMethodForm } from './payment-method-form'

interface Props {
  profileId: string
  methods: PaymentMethod[]
}

export function PaymentMethodsList({ profileId, methods }: Props) {
  const t = useTranslations('PaymentMethods')
  const nextSortOrder = methods.reduce((max, m) => Math.max(max, m.sort_order), -1) + 1

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t('intro')}</p>
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{t('methodCount', { count: methods.length })}</p>
        <PaymentMethodForm profileId={profileId} nextSortOrder={nextSortOrder} />
      </div>
      {methods.length === 0 ? (
        <p className="rounded-lg border border-dashed border-input px-4 py-8 text-center text-sm text-muted-foreground">
          {t('empty')}
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {methods.map(m => (
            <PaymentMethodCard key={m.id} method={m} profileId={profileId} />
          ))}
        </div>
      )}
    </div>
  )
}
