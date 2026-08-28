import { notFound } from 'next/navigation'
import { PrayerModal } from '@/components/prayer/prayer-modal'
import { getProfile } from '@/lib/profile/get-profile'

interface Props { params: Promise<{ username: string }> }

export default async function OracaoModalPage({ params }: Props) {
  const { username } = await params
  const profile = await getProfile(username)

  if (!profile || profile.privacy_mode === 'stealth') notFound()

  return (
    <PrayerModal
      profileId={profile.id}
      username={username}
      missionaryName={profile.display_name}
      missionaryUserId={profile.user_id}
    />
  )
}
