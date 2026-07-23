import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { HistoryView } from '@/components/profile/history-view'
import { ProfileHeader } from '@/components/profile/profile-header'

interface Props { params: Promise<{ username: string }> }

export default async function HistoriaPage({ params }: Props) {
  const { username } = await params
  const supabase = await createClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('username', username)
    .single()

  if (!profile || profile.privacy_mode === 'stealth') notFound()

  const { data: blocks } = await supabase
    .from('history_blocks')
    .select('*')
    .eq('profile_id', profile.id)
    .order('order_index')

  const { count: postsCount } = await supabase
    .from('posts')
    .select('id', { count: 'exact', head: true })
    .eq('profile_id', profile.id)
    .eq('is_draft', false)

  const { count: projectsCount } = await supabase
    .from('highlights')
    .select('id', { count: 'exact', head: true })
    .eq('profile_id', profile.id)
    .eq('status', 'active')

  const { count: achievementsCount } = await supabase
    .from('highlights')
    .select('id', { count: 'exact', head: true })
    .eq('profile_id', profile.id)
    .eq('status', 'completed')

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-8 pb-20 space-y-6">
        <ProfileHeader
          profile={profile}
          postsCount={postsCount ?? 0}
          projectsCount={projectsCount ?? 0}
          achievementsCount={achievementsCount ?? 0}
        />
        <HistoryView blocks={blocks ?? []} />
      </div>
    </div>
  )
}
