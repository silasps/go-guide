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
import { ProfileContentTabs } from '@/components/profile/profile-content-tabs'
import { PostComposerProvider } from '@/components/dashboard/post-composer-provider'
import { ProjectComposerProvider } from '@/components/highlights/project-composer/project-composer-provider'
import { ProfileTabProvider } from '@/components/profile/profile-tab-context'
import { enrichWithEngagement } from '@/lib/posts/enrich-with-engagement'
import type { PostWithProfile, Profile } from '@/types/database'
import { SkCardGrid, SkFeedPosts } from '@/components/ui/skeleton'
import { getProfile, getProfileOrRedirect } from '@/lib/profile/get-profile'
import { getProfileViewerContext } from '@/lib/profile/viewer-context'
import { getFollowCounts } from '@/app/dashboard/feed/follows-list-actions'
import { markNotificationTypesRead } from '@/lib/notifications/mark-read'

interface Props {
  params: Promise<{ username: string }>
  searchParams: Promise<{ post?: string; comments?: string; tab?: string }>
}

const VALID_TABS = ['posts', 'projects', 'history'] as const

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params
  // getProfile() é cache()-wrapped — o page.tsx logo abaixo busca o mesmo
  // perfil, então isso reaproveita a mesma query em vez de duplicar o
  // round-trip ao banco antes até de começar a montar o HTML.
  const profile = await getProfile(username)

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

export default async function ProfilePage({ params, searchParams }: Props) {
  const { username } = await params
  const { post: deepLinkPostId, comments: deepLinkComments, tab } = await searchParams
  const initialTab = VALID_TABS.find((t) => t === tab)
  const profile = await getProfileOrRedirect(username)

  if (!profile) notFound()

  const { canEdit } = await getProfileViewerContext(username)

  // Missionário aguardando aprovação (ver becomeMissionary()) ou conta
  // ocultada por denúncia (migration 056) — bloqueado pra qualquer um que
  // não seja o próprio dono, senão a pessoa recebe doação via link direto
  // mesmo sem aprovação/enquanto revisada, o que anularia o gate.
  if (profile.verification_status === 'pending' && !canEdit) {
    return <UnderReviewScreen name={profile.display_name} messageKey="verificationPendingMessage" />
  }
  if (profile.account_status !== 'active' && !canEdit) {
    return <UnderReviewScreen name={profile.display_name} messageKey={profile.account_status === 'suspended' ? 'accountSuspendedMessage' : 'accountUnderReviewMessage'} />
  }

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
      supabase.from('highlights').select('id', { count: 'exact', head: true }).eq('profile_id', profile.id).eq('status', 'active').is('archived_at', null),
      supabase.from('highlights').select('id', { count: 'exact', head: true }).eq('profile_id', profile.id).eq('status', 'completed').is('archived_at', null),
      supabase.from('posts').select('id', { count: 'exact', head: true }).eq('profile_id', profile.id).eq('is_draft', false).neq('moderation_status', 'removed'),
      profile.user_role === 'missionary' ? getFollowCounts(profile.id) : Promise.resolve(null),
      getLocale() as Promise<Locale>,
    ])

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-xl mx-auto px-4 py-8 space-y-8">
        <ProfileTabProvider initialTab={initialTab}>
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
          <ProfileCTA username={profile.username} profileId={profile.id} hasTrajectory={(completedCount ?? 0) > 0} />
        )}
        <Suspense fallback={<SkCardGrid n={3} />}>
          <ProjectsSectionAsync profileId={profile.id} username={profile.username} accentColor={profile.accent_color} visitorLocale={visitorLocale} />
        </Suspense>
        <Suspense fallback={<SkFeedPosts />}>
          <ProfileContentAsync
            profile={profile}
            visitorLocale={visitorLocale}
            canEdit={canEdit}
            deepLinkPostId={deepLinkPostId}
            deepLinkComments={deepLinkComments === '1'}
          />
        </Suspense>
        </ProfileTabProvider>
      </div>
    </div>
  )
}

async function ProjectsSectionAsync({ profileId, username, accentColor, visitorLocale }: { profileId: string; username: string; accentColor: string; visitorLocale: Locale }) {
  const supabase = await createClient()
  const { data: projects } = await supabase
    .from('highlights')
    .select('*')
    .eq('profile_id', profileId)
    .eq('status', 'active')
    .is('archived_at', null)
    .order('order_index')

  if (!projects || projects.length === 0) return null
  return <ProjectsSection projects={projects} username={username} accentColor={accentColor} visitorLocale={visitorLocale} />
}

async function ProfileContentAsync({ profile, visitorLocale, canEdit, deepLinkPostId, deepLinkComments }: { profile: Profile; visitorLocale: Locale; canEdit: boolean; deepLinkPostId?: string; deepLinkComments: boolean }) {
  const supabase = await createClient()
  const [{ data: { user } }, { viewerUserId }] = await Promise.all([
    supabase.auth.getUser(),
    getProfileViewerContext(profile.username),
  ])
  const isMissionary = profile.user_role === 'missionary'

  // Dono/gestor vendo o próprio perfil — mesmo gatilho que a antiga página
  // /dashboard/publicacoes tinha ao abrir, agora que editar acontece direto
  // aqui.
  if (canEdit && user) {
    await markNotificationTypesRead(supabase, user.id, ['new_post', 'highlight_update'])
  }

  const [{ data: posts }, { data: projects }, { data: historyBlocks }] = await Promise.all([
    supabase
      .from('posts')
      .select('*, highlight:highlights(title, slug, category, cover_url)')
      .eq('profile_id', profile.id)
      .eq('is_draft', false)
      .neq('moderation_status', 'removed')
      .order('published_at', { ascending: false })
      .limit(20),
    isMissionary
      ? supabase.from('highlights').select('*').eq('profile_id', profile.id).eq('status', 'active').is('archived_at', null).order('order_index')
      : Promise.resolve({ data: [] }),
    isMissionary
      ? supabase.from('history_blocks').select('*').eq('profile_id', profile.id).order('order_index')
      : Promise.resolve({ data: [] }),
  ])

  if (!posts || posts.length === 0) return null

  const engagement = await enrichWithEngagement(supabase, posts.map((p) => p.id), user?.id)
  const postsWithProfile = posts.map((post) => ({
    ...post,
    profile: { id: profile.id, username: profile.username, display_name: profile.display_name, avatar_url: profile.avatar_url, accent_color: profile.accent_color, user_role: profile.user_role },
    ...engagement.get(post.id)!,
  })) as unknown as PostWithProfile[]

  const tabs = (
    <ProfileContentTabs
      posts={postsWithProfile}
      projects={projects ?? []}
      historyBlocks={historyBlocks ?? []}
      username={profile.username}
      accentColor={profile.accent_color}
      visitorLocale={visitorLocale}
      showProjects={isMissionary && (projects ?? []).length > 0}
      showHistory={isMissionary && (historyBlocks ?? []).length > 0}
      canEdit={canEdit}
      deepLinkPostId={deepLinkPostId}
      deepLinkComments={deepLinkComments}
    />
  )

  return (
    <div id="conteudo" className="space-y-3 scroll-mt-16">
      {canEdit && viewerUserId ? (
        <ProjectComposerProvider profileId={profile.id}>
          <PostComposerProvider
            profileId={profile.id}
            userId={viewerUserId}
            displayName={profile.display_name}
            avatarUrl={profile.avatar_url}
            originalLocale={profile.locale}
          >
            {tabs}
          </PostComposerProvider>
        </ProjectComposerProvider>
      ) : tabs}
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

async function UnderReviewScreen({ name, messageKey }: { name: string; messageKey: 'verificationPendingMessage' | 'accountUnderReviewMessage' | 'accountSuspendedMessage' }) {
  const t = await getTranslations('PublicProfile')
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="text-center space-y-4 max-w-sm">
        <div className="text-5xl">⏳</div>
        <h1 className="text-xl font-semibold">{name}</h1>
        <p className="text-muted-foreground text-sm">
          {t(messageKey)}
        </p>
      </div>
    </div>
  )
}
