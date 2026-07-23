'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { FollowButton } from '@/components/dashboard/feed/follow-button'
import { getInitials } from '@/lib/utils'
import { usePendingAction } from '@/hooks/use-pending-action'
import { getFollowers, getFollowing, type FollowListEntry } from '@/app/dashboard/feed/follows-list-actions'

interface Props {
  ownerProfileId: string
  kind: 'followers' | 'following'
  initialEntries: FollowListEntry[]
  initialHasMore: boolean
  viewerFollowedIds: string[]
  mutualIds: string[]
  isOwnerView: boolean
}

export function FollowsList({ ownerProfileId, kind, initialEntries, initialHasMore, viewerFollowedIds, mutualIds, isOwnerView }: Props) {
  const t = useTranslations('FollowsList')
  const tFeed = useTranslations('Feed')
  const [entries, setEntries] = useState(initialEntries)
  const [hasMore, setHasMore] = useState(initialHasMore)
  const { isPending, run } = usePendingAction()
  const followedSet = new Set(viewerFollowedIds)
  const mutualSet = new Set(mutualIds)

  function loadMore() {
    run(true, async () => {
      const next = kind === 'followers' ? await getFollowers(ownerProfileId, entries.length) : await getFollowing(ownerProfileId, entries.length)
      setEntries((prev) => [...prev, ...next])
      setHasMore(next.length === 30)
    })
  }

  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-10">{kind === 'followers' ? t('emptyFollowers') : t('emptyFollowing')}</p>
  }

  return (
    <div className="space-y-2">
      {entries.map((entry) => (
        <div key={entry.profileId} className="flex items-center gap-3 p-3 rounded-xl border bg-card">
          <Link href={`/${entry.username}`} className="flex items-center gap-3 min-w-0 flex-1">
            <Avatar className="h-9 w-9 shrink-0">
              <AvatarImage src={entry.avatarUrl ?? ''} alt={entry.displayName} />
              <AvatarFallback className="text-xs">{getInitials(entry.displayName)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{entry.displayName}</p>
              <p className="text-xs text-muted-foreground truncate">
                @{entry.username}
                {kind === 'following' && isOwnerView && mutualSet.has(entry.profileId) && (
                  <span className="ml-2 text-foreground/70">· {t('followsYou')}</span>
                )}
              </p>
            </div>
          </Link>
          <FollowButton
            profileId={entry.profileId}
            initiallyFollowing={followedSet.has(entry.profileId)}
            followsViewer={kind === 'followers' && isOwnerView}
          />
        </div>
      ))}
      {hasMore && (
        <div className="pt-2 text-center">
          <Button variant="ghost" size="sm" disabled={isPending} onClick={loadMore}>
            {isPending ? tFeed('loading') : tFeed('loadMore')}
          </Button>
        </div>
      )}
    </div>
  )
}
