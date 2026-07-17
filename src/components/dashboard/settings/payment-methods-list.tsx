'use client'

import { useTranslations } from 'next-intl'
import { PaymentMethod, FinancialAccount } from '@/types/database'
import { PaymentMethodCard } from './payment-method-card'
import { PaymentMethodForm } from './payment-method-form'
import { StripeConnectCard } from './stripe-connect-card'

interface Props {
  profileId: string
  methods: PaymentMethod[]
  financialAccounts: FinancialAccount[]
}

export function PaymentMethodsList({ profileId, methods, financialAccounts }: Props) {
  const t = useTranslations('PaymentMethods')
  const manualMethods = methods.filter(m => m.type !== 'stripe')
  const stripeMethod = methods.find(m => m.type === 'stripe') ?? null
  const nextSortOrder = manualMethods.reduce((max, m) => Math.max(max, m.sort_order), -1) + 1

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t('intro')}</p>

      <StripeConnectCard stripeMethod={stripeMethod} financialAccounts={financialAccounts} />

      <div className="flex items-center justify-between pt-2">
        <p className="text-sm text-muted-foreground">{t('methodCount', { count: manualMethods.length })}</p>
        <PaymentMethodForm profileId={profileId} nextSortOrder={nextSortOrder} />
      </div>
      {manualMethods.length === 0 ? (
        <p className="rounded-lg border border-dashed border-input px-4 py-8 text-center text-sm text-muted-foreground">
          {t('empty')}
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {manualMethods.map(m => (
            <PaymentMethodCard key={m.id} method={m} profileId={profileId} />
          ))}
        </div>
      )}
    </div>
  )
}
