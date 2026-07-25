import { notFound } from 'next/navigation'
import { PrayerRequestForm } from '@/components/prayer/prayer-request-form'
import { getProfile } from '@/lib/profile/get-profile'

interface Props { params: Promise<{ username: string }> }

export default async function OracaoPage({ params }: Props) {
  const { username } = await params
  const profile = await getProfile(username)

  if (!profile || profile.privacy_mode === 'stealth') notFound()

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Orar por {profile.display_name}</h1>
          <p className="text-muted-foreground mt-2">Envie uma palavra de oração e incentivo para fortalecer essa missão.</p>
        </div>
        <PrayerRequestForm profileId={profile.id} username={username} missionaryName={profile.display_name} missionaryUserId={profile.user_id} />
      </div>
    </div>
  )
}
