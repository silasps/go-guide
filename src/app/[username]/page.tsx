import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getTranslations, getLocale } from 'next-intl/server'
import type { Metadata } from 'next'
import type { Locale } from '@/i18n/config'
import { ProfileHeader } from '@/components/profile/profile-header'
import { ProjectsSection } from '@/components/profile/projects-section'
import { ProfileCTA } from '@/components/profile/profile-cta'
import { ProfileOwnerActions } from '@/components/profile/profile-owner-actions'
import { ProfilePostsGrid } from '@/components/shared/profile-posts-grid'
import { enrichWithEngagement } from '@/lib/posts/enrich-with-engagement'
import type { PostWithProfile, Profile } from '@/types/database'
import { SkCardGrid, SkFeedPosts } from '@/components/ui/skeleton'
import { getProfile } from '@/lib/profile/get-profile'
import { getProfileViewerContext } from '@/lib/profile/viewer-context'
import { getFollowCounts } from '@/app/dashboard/feed/follows-list-actions'

interface Props {
  params: Promise<{ username: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params
  const supabase = await createClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, bio, avatar_url, privacy_mode')
    .eq('username', username)
    .single()

  const t = await getTranslations('PublicProfile')
  if (!profile) return { title: t('notFoundTitle') }

  const isIndexable = profile.privacy_mode === 'public'

  return {
    title: profile.privacy_mode === 'stealth' ? t('missionaryFallbackName') : profile.display_name,
    description: profile.bio ?? undefined,
    openGraph: isIndexable
      ? {
          title: profile.display_name,
          description: profile.bio ?? '',
          images: profile.avatar_url ? [profile.avatar_url] : [],
        }
      : undefined,
    robots: isIndexable ? undefined : { index: false, follow: false },
  }
}

export default async function ProfilePage({ params }: Props) {
  const { username } = await params
  const profile = await getProfile(username)

  if (!profile) notFound()

  const { canEdit } = await getProfileViewerContext(username)

  if (profile.privacy_mode === 'private' && !canEdit) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return <PrivateProfileScreen name={profile.display_name} />
    const { data: partner } = await supabase
      .from('partners')
      .select('id')
      .eq('profile_id', profile.id)
      .eq('user_id', user.id)
      .single()
    if (!partner) return <PrivateProfileScreen name={profile.display_name} />
  }

  // Contagens do header são queries count-only baratas, resolvidas em
  // paralelo — não derivamos mais de projects.length/posts completos, isso
  // deixa o header pronto sem esperar as listas inteiras (que agora
  // streamam depois, ver ProjectsSectionAsync/PublicationsFeedAsync abaixo).
  const supabase = await createClient()
  const [{ count: projectsCount }, { count: completedCount }, { count: postsCount }, followCounts, visitorLocale] =
    await Promise.all([
      supabase.from('highlights').select('id', { count: 'exact', head: true }).eq('profile_id', profile.id).eq('status', 'active'),
      supabase.from('highlights').select('id', { count: 'exact', head: true }).eq('profile_id', profile.id).eq('status', 'completed'),
      supabase.from('posts').select('id', { count: 'exact', head: true }).eq('profile_id', profile.id).eq('is_draft', false),
      profile.user_role === 'missionary' ? getFollowCounts(profile.id) : Promise.resolve(null),
      getLocale() as Promise<Locale>,
    ])

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-xl mx-auto px-4 py-8 space-y-8">
        <ProfileHeader
          profile={profile}
          postsCount={postsCount ?? 0}
          projectsCount={projectsCount ?? 0}
          achievementsCount={completedCount ?? 0}
          followersCount={followCounts?.followers}
          followingCount={followCounts?.following}
        />
        {canEdit ? (
          <ProfileOwnerActions profile={profile} />
        ) : (
          <ProfileCTA username={profile.username} hasTrajectory={(completedCount ?? 0) > 0} />
        )}
        <Suspense fallback={<SkCardGrid n={3} />}>
          <ProjectsSectionAsync profileId={profile.id} username={profile.username} accentColor={profile.accent_color} />
        </Suspense>
        <Suspense fallback={<SkFeedPosts />}>
          <PublicationsFeedAsync profile={profile} visitorLocale={visitorLocale} />
        </Suspense>
      </div>
    </div>
  )
}

async function ProjectsSectionAsync({ profileId, username, accentColor }: { profileId: string; username: string; accentColor: string }) {
  const supabase = await createClient()
  const { data: projects } = await supabase
    .from('highlights')
    .select('*')
    .eq('profile_id', profileId)
    .eq('status', 'active')
    .order('order_index')

  if (!projects || projects.length === 0) return null
  return <ProjectsSection projects={projects} username={username} accentColor={accentColor} />
}

async function PublicationsFeedAsync({ profile, visitorLocale }: { profile: Profile; visitorLocale: Locale }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const t = await getTranslations('PublicProfile')
  const { data: posts } = await supabase
    .from('posts')
    .select('*, highlight:highlights(title, slug, category, cover_url)')
    .eq('profile_id', profile.id)
    .eq('is_draft', false)
    .order('published_at', { ascending: false })
    .limit(20)

  if (!posts || posts.length === 0) return null

  const engagement = await enrichWithEngagement(supabase, posts.map((p) => p.id), user?.id)
  const postsWithProfile = posts.map((post) => ({
    ...post,
    profile: { id: profile.id, username: profile.username, display_name: profile.display_name, avatar_url: profile.avatar_url, accent_color: profile.accent_color },
    ...engagement.get(post.id)!,
  })) as unknown as PostWithProfile[]

  return (
    <div className="space-y-3">
      <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">{t('postsHeading')}</h2>
      <ProfilePostsGrid posts={postsWithProfile} visitorLocale={visitorLocale} />
    </div>
  )
}

async function PrivateProfileScreen({ name }: { name: string }) {
  const t = await getTranslations('PublicProfile')
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="text-center space-y-4 max-w-sm">
        <div className="text-5xl">🔒</div>
        <h1 className="text-xl font-semibold">{name}</h1>
        <p className="text-muted-foreground text-sm">
          {t('privateProfileMessage')}
        </p>
      </div>
    </div>
  )
}
