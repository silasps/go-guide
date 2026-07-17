import { getTranslations } from 'next-intl/server'
import { getDiscoverMissionaries, getFollowedProfileIds } from '@/app/dashboard/feed/actions'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { getInitials } from '@/lib/utils'
import Link from 'next/link'
import { FollowButton } from './follow-button'

export async function DiscoverMissionaries() {
  const t = await getTranslations('Feed')
  const [missionaries, followedIds] = await Promise.all([getDiscoverMissionaries(), getFollowedProfileIds()])
  const followedSet = new Set(followedIds)

  return (
    <div className="space-y-4">
      <div className="text-center space-y-1">
        <p className="font-medium">{t('emptyTitle')}</p>
        <p className="text-sm text-muted-foreground">{t('emptyDescription')}</p>
      </div>

      <div className="space-y-2">
        {missionaries.map((m) => (
          <div key={m.id} className="flex items-center gap-3 p-3 rounded-xl border bg-card">
            <Link href={`/${m.username}`} target="_blank" className="flex items-center gap-3 min-w-0 flex-1">
              <Avatar className="h-9 w-9 shrink-0">
                <AvatarImage src={m.avatar_url ?? ''} alt={m.display_name} />
                <AvatarFallback className="text-xs">{getInitials(m.display_name)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{m.display_name}</p>
                <p className="text-xs text-muted-foreground truncate">{m.bio ?? `@${m.username}`}</p>
              </div>
            </Link>
            <FollowButton profileId={m.id} initiallyFollowing={followedSet.has(m.id)} />
          </div>
        ))}
        {missionaries.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-6">{t('emptyNoMissionaries')}</p>
        )}
      </div>
    </div>
  )
}
