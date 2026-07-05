import { getTranslations } from 'next-intl/server'
import { PricingToggle } from '@/components/pricing/pricing-toggle'
import { SiteNav } from '@/components/marketing/site-nav'
import { SiteFooter } from '@/components/marketing/site-footer'

export default async function PlanosPage() {
  const t = await getTranslations('PricingPage')

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SiteNav />

      <main className="flex-1 px-6 py-16 max-w-5xl mx-auto w-full">
        <div className="text-center max-w-2xl mx-auto mb-4">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-muted-foreground mt-3">
            {t('subtitle')}
          </p>
        </div>

        <PricingToggle />

        <div className="mt-16 grid sm:grid-cols-3 gap-6 text-center max-w-3xl mx-auto">
          <div>
            <p className="font-semibold text-sm">{t('cancelTitle')}</p>
            <p className="text-xs text-muted-foreground mt-1">{t('cancelDesc')}</p>
          </div>
          <div>
            <p className="font-semibold text-sm">{t('dataTitle')}</p>
            <p className="text-xs text-muted-foreground mt-1">{t('dataDesc')}</p>
          </div>
          <div>
            <p className="font-semibold text-sm">{t('moneyTitle')}</p>
            <p className="text-xs text-muted-foreground mt-1">{t('moneyDesc')}</p>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}
