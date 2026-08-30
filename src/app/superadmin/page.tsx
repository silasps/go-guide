import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { createClient as createSupabaseClient, SupabaseClient } from '@supabase/supabase-js'
import { StatCard, StatSection } from '@/components/superadmin/stat-card'
import { daysSince } from '@/lib/utils'

function serviceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function count(service: SupabaseClient, table: string, apply?: (q: any) => any) {
  const base = service.from(table).select('id', { count: 'exact', head: true })
  const query = apply ? apply(base) : base
  const { count: n } = await query
  return n ?? 0
}

export default async function SuperadminDashboardPage() {
  const t = await getTranslations('Superadmin')
  const service = serviceClient()

  const now = new Date()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000).toISOString()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000).toISOString()

  const [
    totalUsers, missionaries, partners,
    genderMale, genderFemale, genderUnspecified,
    privacyPublic, privacyPrivate, privacyStealth,
    pendingVerification, hiddenAccounts, suspendedAccounts,
    newLast7, newLast30,
    openReports, publishedPosts, activeProjects,
    { data: oldestPending }, { data: flaggedAccounts },
  ] = await Promise.all([
    count(service, 'profiles'),
    count(service, 'profiles', (q) => q.eq('user_role', 'missionary')),
    count(service, 'profiles', (q) => q.eq('user_role', 'partner')),
    count(service, 'profiles', (q) => q.eq('gender', 'male')),
    count(service, 'profiles', (q) => q.eq('gender', 'female')),
    count(service, 'profiles', (q) => q.eq('gender', 'unspecified')),
    count(service, 'profiles', (q) => q.eq('privacy_mode', 'public')),
    count(service, 'profiles', (q) => q.eq('privacy_mode', 'private')),
    count(service, 'profiles', (q) => q.eq('privacy_mode', 'stealth')),
    count(service, 'profiles', (q) => q.eq('verification_status', 'pending')),
    count(service, 'profiles', (q) => q.eq('account_status', 'hidden_pending_review')),
    count(service, 'profiles', (q) => q.eq('account_status', 'suspended')),
    count(service, 'profiles', (q) => q.gte('created_at', sevenDaysAgo)),
    count(service, 'profiles', (q) => q.gte('created_at', thirtyDaysAgo)),
    count(service, 'reports', (q) => q.eq('status', 'open')),
    count(service, 'posts', (q) => q.eq('is_draft', false).neq('moderation_status', 'removed')),
    count(service, 'highlights', (q) => q.eq('status', 'active')),
    service.from('profiles')
      .select('id, username, display_name, verification_requested_at, created_at')
      .eq('verification_status', 'pending')
      .order('created_at', { ascending: true })
      .limit(5),
    service.from('profiles')
      .select('id, username, display_name, account_status, account_status_changed_at')
      .in('account_status', ['hidden_pending_review', 'suspended'])
      .order('account_status_changed_at', { ascending: true })
      .limit(5),
  ])

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
      <h1 className="text-xl font-semibold">{t('dashboardTitle')}</h1>

      <StatSection title={t('sectionUsers')}>
        <StatCard label={t('statTotalUsers')} value={totalUsers} />
        <StatCard label={t('statMissionaries')} value={missionaries} />
        <StatCard label={t('statPartners')} value={partners} />
        <StatCard label={t('statNewLast7')} value={newLast7} />
        <StatCard label={t('statNewLast30')} value={newLast30} />
      </StatSection>

      <StatSection title={t('sectionGender')}>
        <StatCard label={t('genderMale')} value={genderMale} />
        <StatCard label={t('genderFemale')} value={genderFemale} />
        <StatCard label={t('genderUnspecified')} value={genderUnspecified} />
      </StatSection>

      <StatSection title={t('sectionVisibility')}>
        <StatCard label={t('privacy_public')} value={privacyPublic} />
        <StatCard label={t('privacy_private')} value={privacyPrivate} />
        <StatCard label={t('privacy_stealth')} value={privacyStealth} />
      </StatSection>

      <StatSection title={t('sectionModeration')}>
        <StatCard label={t('statPendingVerification')} value={pendingVerification} tone={pendingVerification > 0 ? 'warning' : 'default'} />
        <StatCard label={t('statHiddenAccounts')} value={hiddenAccounts} tone={hiddenAccounts > 0 ? 'warning' : 'default'} />
        <StatCard label={t('statSuspendedAccounts')} value={suspendedAccounts} tone={suspendedAccounts > 0 ? 'danger' : 'default'} />
        <StatCard label={t('statOpenReports')} value={openReports} tone={openReports > 0 ? 'warning' : 'default'} />
      </StatSection>

      <StatSection title={t('sectionActivity')}>
        <StatCard label={t('statPublishedPosts')} value={publishedPosts} />
        <StatCard label={t('statActiveProjects')} value={activeProjects} />
      </StatSection>

      {(oldestPending?.length ?? 0) > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground">{t('oldestPendingTitle')}</h2>
          <div className="bg-card border rounded-2xl divide-y">
            {oldestPending!.map((p) => (
              <Link key={p.id} href="/superadmin/moderacao" className="flex items-center justify-between px-4 py-3 text-sm hover:bg-muted/50">
                <span>{p.display_name} <span className="text-muted-foreground">@{p.username}</span></span>
                <span className="text-xs text-muted-foreground shrink-0 ml-2">{t('pendingSince', { days: daysSince(p.verification_requested_at ?? p.created_at) })}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {(flaggedAccounts?.length ?? 0) > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground">{t('flaggedAccountsTitle')}</h2>
          <div className="bg-card border rounded-2xl divide-y">
            {flaggedAccounts!.map((a) => (
              <Link key={a.id} href="/superadmin/usuarios" className="flex items-center justify-between px-4 py-3 text-sm hover:bg-muted/50">
                <span>{a.display_name} <span className="text-muted-foreground">@{a.username}</span></span>
                <span className="text-xs text-muted-foreground shrink-0 ml-2">
                  {a.account_status === 'suspended' ? t('suspended') : t('reviewPending')} · {t('pendingSince', { days: daysSince(a.account_status_changed_at) })}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
