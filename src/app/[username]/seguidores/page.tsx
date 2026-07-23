import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getTranslations } from 'next-intl/server'
import type { Metadata } from 'next'
import { cn } from '@/lib/utils'
import { getProfileViewerContext } from '@/lib/profile/viewer-context'
import { FollowsList } from '@/components/profile/follows-list'
import {
  getFollowers,
  getFollowing,
  getFollowCounts,
  getFollowerProfileIds,
} from '@/app/dashboard/feed/follows-list-actions'
import { getFollowedProfileIds } from '@/app/dashboard/feed/actions'

interface Props {
  params: Promise<{ username: string }>
  searchParams: Promise<{ tab?: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params
  const t = await getTranslations('FollowsList')
  return { title: `${t('tabFollowers')} — ${username}` }
}

export default async function SeguidoresPage({ params, searchParams }: Props) {
  const { username } = await params
  const { tab } = await searchParams
  const kind: 'followers' | 'following' = tab === 'seguindo' ? 'following' : 'followers'

  const supabase = await createClient()
  const t = await getTranslations('FollowsList')

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, display_name, privacy_mode, user_role')
    .eq('username', username)
    .maybeSingle()

  if (!profile || profile.user_role !== 'missionary' || profile.privacy_mode === 'stealth') notFound()

  const { canEdit } = await getProfileViewerContext(username)

  if (profile.privacy_mode === 'private' && !canEdit) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) notFound()
    const { data: partner } = await supabase
      .from('partners')
      .select('id')
      .eq('profile_id', profile.id)
      .eq('user_id', user.id)
      .single()
    if (!partner) notFound()
  }

  const [entries, counts, viewerFollowedIds, mutualIds] = await Promise.all([
    kind === 'followers' ? getFollowers(profile.id) : getFollowing(profile.id),
    getFollowCounts(profile.id),
    getFollowedProfileIds(),
    canEdit && kind === 'following' ? getFollowerProfileIds(profile.id) : Promise.resolve<string[]>([]),
  ])

  const base = `/${username}/seguidores`

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-xl mx-auto px-4 py-8 space-y-6">
        <div>
          <h1 className="text-xl font-semibold">{profile.display_name}</h1>
        </div>

        <div className="flex rounded-lg border p-1 bg-muted/40">
          <Link
            href={base}
            className={cn(
              'flex-1 text-center rounded-md py-2 text-sm font-medium transition-colors',
              kind === 'followers' ? 'bg-background shadow-sm' : 'text-muted-foreground'
            )}
          >
            {t('tabFollowers')} ({counts.followers})
          </Link>
          <Link
            href={`${base}?tab=seguindo`}
            className={cn(
              'flex-1 text-center rounded-md py-2 text-sm font-medium transition-colors',
              kind === 'following' ? 'bg-background shadow-sm' : 'text-muted-foreground'
            )}
          >
            {t('tabFollowing')} ({counts.following})
          </Link>
        </div>

        <FollowsList
          key={kind}
          ownerProfileId={profile.id}
          kind={kind}
          initialEntries={entries}
          initialHasMore={entries.length === 30}
          viewerFollowedIds={viewerFollowedIds}
          mutualIds={mutualIds}
          isOwnerView={canEdit}
        />
      </div>
    </div>
  )
}
