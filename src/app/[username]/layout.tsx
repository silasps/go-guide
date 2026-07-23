import { ProfileTabs } from '@/components/profile/profile-tabs'
import { createClient } from '@/lib/supabase/server'
import { getProfileViewerContext } from '@/lib/profile/viewer-context'

interface Props {
  children: React.ReactNode
  params: Promise<{ username: string }>
}

export default async function UsernameLayout({ children, params }: Props) {
  const { username } = await params
  const supabase = await createClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, accent_color, plan, user_role')
    .eq('username', username)
    .maybeSingle()

  let hasTrajectory = false
  if (profile) {
    const { count } = await supabase
      .from('highlights')
      .select('id', { count: 'exact', head: true })
      .eq('profile_id', profile.id)
      .eq('status', 'completed')
    hasTrajectory = (count ?? 0) > 0
  }

  const { canEdit, viewerUserId } = await getProfileViewerContext(username)

  return (
    <>
      <ProfileTabs
        username={username}
        hasTrajectory={hasTrajectory}
        isMissionary={profile?.user_role === 'missionary'}
        canEdit={canEdit}
        viewerUserId={viewerUserId}
        ownerProfile={profile ?? null}
      />
      {children}
    </>
  )
}
