import Link from 'next/link'
import Image from 'next/image'
import { getTranslations } from 'next-intl/server'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PRICING_PLANS } from '@/lib/pricing'
import { APP_MODULES, MODULE_COLOR_CLASSES } from '@/lib/modules'
import { SiteNav } from '@/components/marketing/site-nav'
import { SiteFooter } from '@/components/marketing/site-footer'
import {
  Check, UserPlus, Settings2, Wallet, FolderPlus, ShieldCheck, Landmark, Globe2,
} from 'lucide-react'

const stepIcons = [UserPlus, Settings2, Wallet, FolderPlus]
const differentiatorIcons = [ShieldCheck, Landmark, Globe2]

// Módulos com destaque de conteúdo (Stripe-style "solution overview") — os 3 mais estratégicos.
const DEEP_DIVE_IDS = ['perfil-publico', 'projetos', 'financeiro']

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect('/dashboard')

  const t = await getTranslations('Landing')
  const tModules = await getTranslations('Modules')
  const tPricing = await getTranslations('Pricing')

  const steps = [1, 2, 3, 4].map((n) => ({
    icon: stepIcons[n - 1],
    title: t(`step${n}Title`),
    description: t(`step${n}Desc`),
  }))

  const differentiators = [
    { icon: differentiatorIcons[0], title: t('diffShieldTitle'), description: t('diffShieldDesc') },
    { icon: differentiatorIcons[1], title: t('diffMoneyTitle'), description: t('diffMoneyDesc') },
    { icon: differentiatorIcons[2], title: t('diffGlobalTitle'), description: t('diffGlobalDesc') },
  ]

  const deepDiveModules = APP_MODULES.filter((m) => DEEP_DIVE_IDS.includes(m.id))

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SiteNav />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute left-1/2 top-[-10%] h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-primary/15 blur-3xl" />
          <div className="absolute right-[-10%] top-[20%] h-[260px] w-[260px] rounded-full bg-emerald-500/10 blur-3xl" />
          <div className="absolute left-[-10%] top-[15%] h-[260px] w-[260px] rounded-full bg-amber-500/10 blur-3xl" />
        </div>

        <div className="px-6 py-16 sm:py-20 max-w-5xl mx-auto grid lg:grid-cols-2 gap-12 items-center">
          <div className="text-center lg:text-left space-y-8">
            <div className="space-y-4">
              <h1 className="text-4xl sm:text-5xl font-bold leading-tight tracking-tight">
                {t('heroTitleLine1')}<br />
                <span className="text-primary">{t('heroTitleHighlight')}</span>
              </h1>
              <p className="text-muted-foreground text-lg max-w-md mx-auto lg:mx-0">
                {t('heroSubtitle')}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 w-full max-w-sm mx-auto lg:mx-0">
              <Link href="/cadastro" className={cn(buttonVariants({ size: 'lg' }), 'flex-1 h-12 px-8 rounded-full text-base font-semibold')}>
                {t('ctaComecar')}
              </Link>
              <Link href="/planos" className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'flex-1 h-12 px-8 rounded-full text-base font-semibold border-2 border-foreground/20 hover:border-foreground/30')}>
                {t('ctaVerPlanos')}
              </Link>
            </div>

            <div className="flex flex-wrap justify-center lg:justify-start gap-2 text-sm">
              {APP_MODULES.map(({ id, icon: Icon, color }) => (
                <Link
                  key={id}
                  href={`/#modulo-${id}`}
                  className={cn('flex items-center gap-1.5 pl-2.5 pr-3.5 py-1.5 rounded-full font-medium transition-transform hover:scale-105', MODULE_COLOR_CLASSES[color])}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {tModules(`${id}.title`)}
                </Link>
              ))}
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-sm lg:max-w-none">
            <div className="relative aspect-[4/5] rounded-3xl overflow-hidden ring-1 ring-foreground/10 shadow-xl">
              <Image
                src="/hero-missionario.png"
                alt={t('heroImageAlt')}
                fill
                priority
                sizes="(min-width: 1024px) 480px, 384px"
                className="object-cover"
              />
            </div>
            <div className="absolute -bottom-5 -left-4 sm:-left-6 bg-card rounded-xl ring-1 ring-foreground/10 shadow-lg px-4 py-3 max-w-[230px]">
              <p className="text-xs font-semibold leading-snug">{t('heroBadgeTitle')}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{t('heroBadgeSubtitle')}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Diferenciais */}
      <section className="px-6 py-10 border-y bg-muted/30">
        <div className="max-w-4xl mx-auto grid sm:grid-cols-3 gap-6">
          {differentiators.map(({ icon: Icon, title, description }) => (
            <div key={title} className="flex items-start gap-3">
              <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Icon className="h-4.5 w-4.5 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-sm">{title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Como funciona */}
      <section className="px-6 py-16">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-2">{t('comoFuncionaTitle')}</h2>
          <p className="text-muted-foreground text-center mb-10">{t('comoFuncionaSubtitle')}</p>
          <div className="relative grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="hidden lg:block absolute top-4 left-[12.5%] right-[12.5%] h-px bg-border" />
            {steps.map(({ icon: Icon, title, description }, i) => (
              <div key={title} className="relative bg-background">
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0 relative z-10">
                    {i + 1}
                  </div>
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <p className="font-semibold text-sm">{title}</p>
                <p className="text-xs text-muted-foreground mt-1">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Vitrine de módulos — bento grid */}
      <section id="modulos" className="px-6 py-16 border-t bg-muted/30">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-2">{t('modulesTitle')}</h2>
          <p className="text-muted-foreground text-center mb-10">{t('modulesSubtitle')}</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 auto-rows-fr">
            {APP_MODULES.map(({ id, icon: Icon, color }, i) => (
              <div
                key={id}
                id={`modulo-${id}`}
                className={cn(
                  'rounded-xl ring-1 ring-foreground/10 bg-card p-5 scroll-mt-24',
                  i === 0 && 'sm:col-span-2 lg:col-span-2 lg:row-span-1'
                )}
              >
                <div className={cn('h-10 w-10 rounded-lg flex items-center justify-center mb-3', MODULE_COLOR_CLASSES[color])}>
                  <Icon className="h-5 w-5" />
                </div>
                <p className="font-semibold text-sm">{tModules(`${id}.title`)}</p>
                <p className="text-xs text-muted-foreground mt-1.5">{tModules(`${id}.description`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Deep-dive de módulos estratégicos */}
      <section className="px-6 py-16">
        <div className="max-w-4xl mx-auto space-y-16">
          {deepDiveModules.map(({ id, icon: Icon, color }, i) => (
            <div key={id} className={cn('flex flex-col md:flex-row items-center gap-10', i % 2 === 1 && 'md:flex-row-reverse')}>
              <div className="flex-1 space-y-3">
                <div className={cn('h-11 w-11 rounded-xl flex items-center justify-center', MODULE_COLOR_CLASSES[color])}>
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="text-xl font-bold">{tModules(`${id}.title`)}</h3>
                <p className="text-muted-foreground text-sm">{tModules(`${id}.description`)}</p>
                <ul className="space-y-2 pt-2">
                  {tModules.raw(`${id}.bullets`).map((b: string) => (
                    <li key={b} className="flex items-start gap-2 text-sm">
                      <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </div>
              {id === 'perfil-publico' ? (
                <div className="relative flex-1 w-full aspect-[4/5] max-w-xs mx-auto rounded-2xl overflow-hidden ring-1 ring-foreground/10 shadow-lg">
                  <Image
                    src="/missionario-sorrindo.png"
                    alt={t('deepDiveImageAlt')}
                    fill
                    sizes="320px"
                    className="object-cover"
                  />
                </div>
              ) : (
                <div className={cn('flex-1 rounded-2xl w-full h-48 flex items-center justify-center', MODULE_COLOR_CLASSES[color])}>
                  <Icon className="h-16 w-16 opacity-40" />
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Planos (teaser) */}
      <section className="px-6 py-16 border-t bg-muted/30">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-2">{t('planosTitle')}</h2>
          <p className="text-muted-foreground text-center mb-10">{t('planosSubtitle')}</p>
          <div className="grid sm:grid-cols-3 gap-5">
            {PRICING_PLANS.map((plan) => (
              <div key={plan.id} className={cn('rounded-xl ring-1 ring-foreground/10 bg-card p-5', plan.highlighted && 'ring-2 ring-primary')}>
                <p className="font-semibold text-sm">{tPricing(`${plan.id}.name`)}</p>
                <p className="text-2xl font-bold mt-2">{plan.priceMonthly === 0 ? t('free') : `$${plan.priceMonthly}`}
                  {plan.priceMonthly > 0 && <span className="text-sm font-normal text-muted-foreground">{t('perMonth')}</span>}
                </p>
                <ul className="mt-3 space-y-1.5">
                  {tPricing.raw(`${plan.id}.features`).slice(0, 3).map((f: string) => (
                    <li key={f} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                      <Check className="h-3 w-3 text-primary shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="text-center mt-8">
            <Link href="/planos" className={cn(buttonVariants({ size: 'lg' }), 'h-12 px-8 rounded-full text-base font-semibold')}>{t('verTodosPlanos')}</Link>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  )
}
