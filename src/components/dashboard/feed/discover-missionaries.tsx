import { getTranslations } from 'next-intl/server'
import Image from 'next/image'
import { getDiscoverMissionaries, getFollowedProfileIds } from '@/app/dashboard/feed/actions'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { getInitials } from '@/lib/utils'
import { MapPin } from 'lucide-react'
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

      <div className="grid grid-cols-2 gap-3">
        {missionaries.map((m) => (
          <div key={m.id} className="group/discover relative rounded-2xl border bg-card overflow-hidden flex flex-col">
            <Link href={`/${m.username}`} className="flex flex-col flex-1 min-w-0">
              <div
                className="relative aspect-[4/3] w-full"
                style={!m.cover_url ? { background: `linear-gradient(135deg, ${m.accent_color}, color-mix(in oklch, ${m.accent_color}, black 35%))` } : undefined}
              >
                {m.cover_url && (
                  <Image src={m.cover_url} alt="" fill className="object-cover" sizes="200px" />
                )}
                <div className="absolute -bottom-5 left-3">
                  <Avatar className="h-11 w-11 shrink-0 ring-4 ring-card">
                    <AvatarImage src={m.avatar_url ?? ''} alt={m.display_name} />
                    <AvatarFallback className="text-xs">{getInitials(m.display_name)}</AvatarFallback>
                  </Avatar>
                </div>
              </div>

              <div className="p-3 pt-7 space-y-1 flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{m.display_name}</p>
                {m.show_location && m.location ? (
                  <p className="flex items-center gap-1 text-xs text-muted-foreground truncate">
                    <MapPin className="h-3 w-3 shrink-0" />
                    {m.location}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground truncate">@{m.username}</p>
                )}
                {m.bio && <p className="text-xs text-muted-foreground line-clamp-2">{m.bio}</p>}
              </div>
            </Link>
            <div className="px-3 pb-3">
              <FollowButton profileId={m.id} initiallyFollowing={followedSet.has(m.id)} />
            </div>
          </div>
        ))}
        {missionaries.length === 0 && (
          <p className="col-span-2 text-sm text-muted-foreground text-center py-6">{t('emptyNoMissionaries')}</p>
        )}
      </div>
    </div>
  )
}
