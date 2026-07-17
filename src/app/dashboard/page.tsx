import { getActiveProfile } from '@/lib/profile/active-profile'
import { redirect } from 'next/navigation'
import { FeedScreen } from '@/components/dashboard/feed/feed-screen'

export default async function DashboardHomePage() {
  const profile = await getActiveProfile()
  if (!profile) redirect('/login')

  return <FeedScreen viewerUserId={profile.user_id} />
}
