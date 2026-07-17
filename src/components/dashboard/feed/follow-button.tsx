'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { usePendingAction } from '@/hooks/use-pending-action'
import { followProfile, unfollowProfile } from '@/app/dashboard/feed/actions'
import { cn } from '@/lib/utils'

export function FollowButton({ profileId, initiallyFollowing }: { profileId: string; initiallyFollowing: boolean }) {
  const t = useTranslations('Feed')
  const router = useRouter()
  const [following, setFollowing] = useState(initiallyFollowing)
  const { isPending, run } = usePendingAction()

  function toggle() {
    const next = !following
    setFollowing(next)
    run(true, async () => {
      if (next) await followProfile(profileId)
      else await unfollowProfile(profileId)
      router.refresh()
    })
  }

  return (
    <Button
      size="sm"
      variant={following ? 'outline' : 'default'}
      disabled={isPending}
      onClick={toggle}
      className={cn('shrink-0', following && 'text-muted-foreground')}
    >
      {following ? t('following') : t('follow')}
    </Button>
  )
}
