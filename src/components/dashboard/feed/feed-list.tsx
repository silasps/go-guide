'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import type { Locale } from '@/i18n/config'
import { PostWithProfile } from '@/types/database'
import { getFeedPage } from '@/app/dashboard/feed/actions'
import { FeedPostCard } from './feed-post-card'
import { Button } from '@/components/ui/button'
import { usePendingAction } from '@/hooks/use-pending-action'

interface Props {
  initialPosts: PostWithProfile[]
  initialCursor: string | null
  followedProfileIds: string[]
  visitorLocale: Locale
}

export function FeedList({ initialPosts, initialCursor, followedProfileIds, visitorLocale }: Props) {
  const t = useTranslations('Feed')
  const [posts, setPosts] = useState(initialPosts)
  const [cursor, setCursor] = useState(initialCursor)
  const followedSet = new Set(followedProfileIds)
  const { isPending, run } = usePendingAction()

  function loadMore() {
    run(true, async () => {
      const page = await getFeedPage(cursor)
      setPosts((prev) => [...prev, ...page.posts])
      setCursor(page.nextCursor)
    })
  }

  return (
    <div className="space-y-4">
      {posts.map((post) => (
        <FeedPostCard key={post.id} post={post} visitorLocale={visitorLocale} isFollowing={followedSet.has(post.profile_id)} />
      ))}

      {cursor && (
        <div className="flex justify-center pt-2">
          <Button variant="outline" size="sm" disabled={isPending} onClick={loadMore}>
            {isPending ? t('loading') : t('loadMore')}
          </Button>
        </div>
      )}
    </div>
  )
}
