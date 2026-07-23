import { getLocale, getTranslations } from 'next-intl/server'
import { getFeedPage, getFollowedProjectStories } from '@/app/dashboard/feed/actions'
import { FeedList } from './feed-list'
import { ProjectStoriesRow } from './project-stories-row'
import { DiscoverMissionaries } from './discover-missionaries'
import { ComposeBar } from './compose-bar'
import type { Locale } from '@/i18n/config'
import type { UserRole } from '@/types/database'

interface Props {
  viewerUserId: string
  role: UserRole
  displayName: string
  avatarUrl: string | null
}

export async function FeedScreen({ viewerUserId, role, displayName, avatarUrl }: Props) {
  const t = await getTranslations('Feed')
  const locale = (await getLocale()) as Locale
  void viewerUserId

  const [{ posts, nextCursor }, stories] = await Promise.all([
    getFeedPage(null),
    getFollowedProjectStories(),
  ])

  return (
    <div className="max-w-xl mx-auto space-y-4">
      {role !== 'partner' && <ComposeBar displayName={displayName} avatarUrl={avatarUrl} />}

      <ProjectStoriesRow stories={stories} />

      <h1 className="text-lg font-semibold">{t('title')}</h1>

      {posts.length === 0 ? (
        <DiscoverMissionaries showBecomeMissionary={role === 'partner'} />
      ) : (
        <FeedList initialPosts={posts} initialCursor={nextCursor} visitorLocale={locale} />
      )}
    </div>
  )
}
