import { createClient } from '@/lib/supabase/server'
import { getActiveProfile } from '@/lib/profile/active-profile'
import { getLocale, getTranslations } from 'next-intl/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, FileText, Heart, Sparkles, Plus, FolderOpen, ArrowRight } from 'lucide-react'
import { SetupChecklistBanner } from '@/components/dashboard/setup-checklist-banner'
import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export default async function DashboardPage() {
  const supabase = await createClient()
  const profile = await getActiveProfile()
  const t = await getTranslations('DashboardOverview')

  const [
    { count: partnersCount },
    { count: postsCount },
    { count: prayerCount },
    { count: highlightsCount },
  ] = await Promise.all([
    supabase.from('partners').select('*', { count: 'exact', head: true }).eq('profile_id', profile!.id),
    supabase.from('posts').select('*', { count: 'exact', head: true }).eq('profile_id', profile!.id).eq('is_draft', false),
    supabase.from('prayer_requests').select('*', { count: 'exact', head: true }).eq('profile_id', profile!.id).eq('is_answered', false),
    supabase.from('highlights').select('*', { count: 'exact', head: true }).eq('profile_id', profile!.id),
  ])

  const stats = [
    { label: t('statPartners'), value: partnersCount ?? 0, icon: Users, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-950/40', href: '/dashboard/parceiros' },
    { label: t('statPosts'), value: postsCount ?? 0, icon: FileText, color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-950/40', href: '/dashboard/publicacoes' },
    { label: t('statPrayers'), value: prayerCount ?? 0, icon: Heart, color: 'text-rose-500', bg: 'bg-rose-50 dark:bg-rose-950/40', href: '/dashboard/oracoes' },
    { label: t('statAiCredits'), value: profile?.ai_credits ?? 0, icon: Sparkles, color: 'text-violet-500', bg: 'bg-violet-50 dark:bg-violet-950/40', href: '/planos' },
  ]

  const quickActions = [
    { href: '/dashboard/publicacoes/nova', label: t('newPost'), icon: Plus, description: t('newPostDesc') },
    { href: '/dashboard/projetos/novo', label: t('newProject'), icon: FolderOpen, description: t('newProjectDesc') },
  ]

  const firstName = profile?.display_name?.split(' ')[0]

  return (
    <div className="space-y-6">
      <SetupChecklistBanner
        avatarUrl={profile?.avatar_url ?? null}
        username={profile?.username ?? ''}
        hasPaymentMethod={Boolean(profile?.pix_key || profile?.paypal_url || profile?.wise_url || profile?.external_donation_url)}
        hasProject={(highlightsCount ?? 0) > 0}
      />

      {/* Greeting */}
      <div>
        <h1 className="text-xl font-semibold">{t('greeting', { name: firstName ?? '' })}</h1>
        <p className="text-muted-foreground text-sm mt-0.5">{t('subtitle')}</p>
      </div>

      {/* Stats grid — 2 col mobile, 4 col desktop */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {stats.map(({ label, value, icon: Icon, color, bg, href }) => (
          <Link key={label} href={href}>
            <Card className="border-0 shadow-none bg-card transition-colors hover:bg-muted/60">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs text-muted-foreground font-medium mb-1">{label}</p>
                    <p className="text-2xl font-bold">{value}</p>
                  </div>
                  <div className={cn('p-2 rounded-lg shrink-0', bg)}>
                    <Icon className={cn('h-4 w-4', color)} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Main content: 2-col on desktop */}
      <div className="grid gap-4 lg:grid-cols-[1fr_240px]">
        {/* Recent posts */}
        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold">{t('recentPosts')}</CardTitle>
            <Link
              href="/dashboard/publicacoes"
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
            >
              {t('viewAll')} <ArrowRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent className="pt-0">
            <RecentPosts profileId={profile!.id} />
          </CardContent>
        </Card>

        {/* Quick actions — visible on desktop as sidebar, stacked on mobile */}
        <div className="space-y-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">{t('quickActions')}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-2">
              {quickActions.map(({ href, label, icon: Icon, description }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-muted transition-colors group"
                >
                  <div className="p-1.5 bg-muted rounded-md shrink-0 group-hover:bg-background transition-colors">
                    <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium leading-tight">{label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
                  </div>
                </Link>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-2 font-medium">{t('yourPublicProfile')}</p>
              <Link
                href={`/${profile?.username}`}
                target="_blank"
                className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'w-full text-xs')}
              >
                {t('viewAsPartners')}
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

async function RecentPosts({ profileId }: { profileId: string }) {
  const supabase = await createClient()
  const locale = await getLocale()
  const t = await getTranslations('DashboardOverview')
  const tPostType = await getTranslations('PostType')
  const { data: posts } = await supabase
    .from('posts')
    .select('id, content, type, published_at')
    .eq('profile_id', profileId)
    .eq('is_draft', false)
    .order('published_at', { ascending: false })
    .limit(5)

  if (!posts?.length) {
    return (
      <div className="py-6 text-center">
        <p className="text-sm text-muted-foreground">{t('noPostsYet')}</p>
        <Link
          href="/dashboard/publicacoes/nova"
          className={cn(buttonVariants({ size: 'sm' }), 'mt-3 gap-1.5')}
        >
          <Plus className="h-3.5 w-3.5" />
          {t('createFirstPost')}
        </Link>
      </div>
    )
  }

  return (
    <ul className="divide-y">
      {posts.map((post) => (
        <li key={post.id} className="flex items-center gap-3 py-2.5 text-sm first:pt-0 last:pb-0">
          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded shrink-0">
            {tPostType.has(post.type) ? tPostType(post.type as 'text') : post.type}
          </span>
          <span className="truncate text-muted-foreground flex-1">
            {post.content?.slice(0, 60) ?? t('noText')}
          </span>
          <span className="text-xs text-muted-foreground ml-auto shrink-0">
            {post.published_at ? new Date(post.published_at).toLocaleDateString(locale, { day: '2-digit', month: 'short' }) : '—'}
          </span>
        </li>
      ))}
    </ul>
  )
}
