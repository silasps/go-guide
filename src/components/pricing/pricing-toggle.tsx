'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PRICING_PLANS, type PlanId } from '@/lib/pricing'
import { toast } from 'sonner'
import { Check, Loader2 } from 'lucide-react'

export function PricingToggle() {
  const t = useTranslations('PricingPage')
  const tPricing = useTranslations('Pricing')
  const [interval, setInterval] = useState<'monthly' | 'yearly'>('monthly')
  const [loadingPlan, setLoadingPlan] = useState<PlanId | null>(null)

  async function handleSubscribe(plan: PlanId) {
    if (plan === 'free') {
      window.location.href = '/cadastro'
      return
    }

    setLoadingPlan(plan)
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan, interval }),
      })

      if (res.status === 401) {
        window.location.href = `/cadastro?redirect=/planos`
        return
      }
      if (!res.ok) {
        toast.info(t('notConfigured'))
        return
      }

      const { url } = await res.json()
      if (url) window.location.href = url
    } finally {
      setLoadingPlan(null)
    }
  }

  return (
    <div>
      {/* Toggle mensal/anual */}
      <div className="flex items-center justify-center gap-3 mb-10">
        <button
          onClick={() => setInterval('monthly')}
          className={cn('text-sm font-medium px-3 py-1.5 rounded-full transition-colors', interval === 'monthly' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground')}
        >
          {t('monthly')}
        </button>
        <button
          onClick={() => setInterval('yearly')}
          className={cn('text-sm font-medium px-3 py-1.5 rounded-full transition-colors flex items-center gap-1.5', interval === 'yearly' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground')}
        >
          {t('yearly')}
          <Badge variant="secondary" className="text-[10px]">{t('twoMonthsFree')}</Badge>
        </button>
      </div>

      <div className="grid gap-6 md:grid-cols-3 items-start">
        {PRICING_PLANS.map((plan) => {
          const price = interval === 'monthly' ? plan.priceMonthly : plan.priceYearly
          return (
            <div
              key={plan.id}
              className={cn(
                'rounded-xl ring-1 ring-foreground/10 bg-card p-6 flex flex-col',
                plan.highlighted && 'ring-2 ring-primary shadow-lg relative'
              )}
            >
              {plan.highlighted && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">{t('mostPopular')}</Badge>
              )}
              <h3 className="font-semibold text-lg">{tPricing(`${plan.id}.name`)}</h3>
              <p className="text-sm text-muted-foreground mt-1">{tPricing(`${plan.id}.tagline`)}</p>
              <div className="mt-4 mb-6">
                <span className="text-3xl font-bold">
                  {price === 0 ? t('free') : `$${price}`}
                </span>
                {price > 0 && (
                  <span className="text-muted-foreground text-sm">{interval === 'monthly' ? t('perMonth') : t('perYear')}</span>
                )}
              </div>
              <ul className="space-y-2.5 mb-6 flex-1">
                {tPricing.raw(`${plan.id}.features`).map((f: string) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <Button
                variant={plan.highlighted ? 'default' : 'outline'}
                disabled={loadingPlan === plan.id}
                onClick={() => handleSubscribe(plan.id)}
              >
                {loadingPlan === plan.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {tPricing(`${plan.id}.cta`)}
              </Button>
            </div>
          )
        })}
      </div>

      <p className="text-center text-xs text-muted-foreground mt-8">
        {t('acceptsGlobalCards')}
      </p>
    </div>
  )
}
