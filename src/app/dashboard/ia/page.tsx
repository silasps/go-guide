import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { getActiveProfile } from '@/lib/profile/active-profile'
import { planLimits, formatRelativeTime, cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { buttonVariants } from '@/components/ui/button'
import { Sparkles, Languages, ArrowRight } from 'lucide-react'

const REASON_KEYS: Record<string, string> = {
  translate_content: 'reasonTranslateContent',
}

export default async function AICopilotPage() {
  const t = await getTranslations('AICopilot')
  const supabase = await createClient()
  const profile = await getActiveProfile()

  const { data: transactions } = await supabase
    .from('ai_credit_transactions')
    .select('id, amount, reason, created_at')
    .eq('profile_id', profile!.id)
    .order('created_at', { ascending: false })
    .limit(20)

  const limits = planLimits(profile!.plan)
  const isFree = profile!.plan === 'free'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">{t('title')}</h1>
        <p className="text-muted-foreground text-sm mt-0.5">{t('subtitle')}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardContent className="pt-6 flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-violet-50 dark:bg-violet-950/40 flex items-center justify-center shrink-0">
              <Sparkles className="h-6 w-6 text-violet-500" />
            </div>
            <div>
              <p className="text-3xl font-bold">{profile!.ai_credits}</p>
              <p className="text-sm text-muted-foreground">{t('balanceLabel')}</p>
            </div>
          </CardContent>
          <CardContent className="pt-0">
            <p className="text-xs text-muted-foreground">
              {isFree ? t('balancePlanFree') : t('balancePlanPaid', { credits: limits.aiCreditsIncluded })}
            </p>
          </CardContent>
        </Card>

        {isFree && (
          <Card className="border-primary/30 bg-primary/5">
            <CardHeader>
              <CardTitle className="text-base">{t('upgradeTitle')}</CardTitle>
              <CardDescription>{t('upgradeDesc')}</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/planos" className={cn(buttonVariants(), 'gap-1.5')}>
                {t('upgradeCta')}
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">{t('featuresTitle')}</h2>
        <Card>
          <CardContent className="pt-6 flex items-start gap-4">
            <div className="h-10 w-10 rounded-lg bg-violet-50 dark:bg-violet-950/40 flex items-center justify-center shrink-0">
              <Languages className="h-5 w-5 text-violet-500" />
            </div>
            <div className="flex-1 min-w-0 space-y-2">
              <div>
                <p className="font-medium text-sm">{t('translateTitle')}</p>
                <p className="text-sm text-muted-foreground">{t('translateDesc')}</p>
                <p className="text-xs text-muted-foreground mt-1">{t('translateCost')}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link href="/dashboard/publicacoes/nova" className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>
                  {t('translateCtaPosts')}
                </Link>
                <Link href="/dashboard/configuracoes" className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>
                  {t('translateCtaProfile')}
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
        <p className="text-xs text-muted-foreground text-center py-2">{t('moreComingSoon')}</p>
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">{t('historyTitle')}</h2>
        {!transactions?.length ? (
          <p className="text-sm text-muted-foreground py-8 text-center">{t('historyEmpty')}</p>
        ) : (
          <div className="space-y-1.5">
            {transactions.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between p-3 rounded-xl border bg-card">
                <div>
                  <p className="text-sm font-medium">{t(REASON_KEYS[tx.reason] ?? 'reasonTranslateContent')}</p>
                  <p className="text-xs text-muted-foreground">{formatRelativeTime(tx.created_at)}</p>
                </div>
                <span className={cn('text-sm font-mono font-medium', tx.amount < 0 ? 'text-muted-foreground' : 'text-green-600 dark:text-green-500')}>
                  {tx.amount > 0 ? '+' : ''}{tx.amount}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
