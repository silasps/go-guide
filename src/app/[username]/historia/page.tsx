import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { HistoryView } from '@/components/profile/history-view'
import { ProfileHeader } from '@/components/profile/profile-header'
import { SkList } from '@/components/ui/skeleton'
import { getProfile } from '@/lib/profile/get-profile'

interface Props { params: Promise<{ username: string }> }

export default async function HistoriaPage({ params }: Props) {
  const { username } = await params
  const profile = await getProfile(username)

  if (!profile || profile.privacy_mode === 'stealth') notFound()

  const supabase = await createClient()
  const [{ count: postsCount }, { count: projectsCount }, { count: achievementsCount }] = await Promise.all([
    supabase.from('posts').select('id', { count: 'exact', head: true }).eq('profile_id', profile.id).eq('is_draft', false),
    supabase.from('highlights').select('id', { count: 'exact', head: true }).eq('profile_id', profile.id).eq('status', 'active'),
    supabase.from('highlights').select('id', { count: 'exact', head: true }).eq('profile_id', profile.id).eq('status', 'completed'),
  ])

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-8 pb-20 space-y-6">
        <ProfileHeader
          profile={profile}
          postsCount={postsCount ?? 0}
          projectsCount={projectsCount ?? 0}
          achievementsCount={achievementsCount ?? 0}
        />
        <Suspense fallback={<SkList n={3} />}>
          <HistoryBlocksAsync profileId={profile.id} />
        </Suspense>
      </div>
    </div>
  )
}

async function HistoryBlocksAsync({ profileId }: { profileId: string }) {
  const supabase = await createClient()
  const { data: blocks } = await supabase
    .from('history_blocks')
    .select('*')
    .eq('profile_id', profileId)
    .order('order_index')

  return <HistoryView blocks={blocks ?? []} />
}
