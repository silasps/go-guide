import { getLocale, getTranslations } from 'next-intl/server'
import { getFeedPage, getFollowedProfileIds, getFollowedProjectStories } from '@/app/dashboard/feed/actions'
import { FeedList } from './feed-list'
import { ProjectStoriesRow } from './project-stories-row'
import { DiscoverMissionaries } from './discover-missionaries'
import type { Locale } from '@/i18n/config'

export async function FeedScreen({ viewerUserId }: { viewerUserId: string }) {
  const t = await getTranslations('Feed')
  const locale = (await getLocale()) as Locale
  void viewerUserId

  const [{ posts, nextCursor }, followedProfileIds, stories] = await Promise.all([
    getFeedPage(null),
    getFollowedProfileIds(),
    getFollowedProjectStories(),
  ])

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <ProjectStoriesRow stories={stories} />

      <h1 className="text-lg font-semibold">{t('title')}</h1>

      {posts.length === 0 ? (
        <DiscoverMissionaries />
      ) : (
        <FeedList initialPosts={posts} initialCursor={nextCursor} followedProfileIds={followedProfileIds} visitorLocale={locale} />
      )}
    </div>
  )
}
