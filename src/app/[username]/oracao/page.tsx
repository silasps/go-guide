import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PrayerRequestForm } from '@/components/prayer/prayer-request-form'

interface Props { params: Promise<{ username: string }> }

export default async function OracaoPage({ params }: Props) {
  const { username } = await params
  const supabase = await createClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, user_id, display_name, privacy_mode')
    .eq('username', username)
    .single()

  if (!profile || profile.privacy_mode === 'stealth') notFound()

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Enviar pedido de oração</h1>
          <p className="text-muted-foreground mt-2">para {profile.display_name}</p>
        </div>
        <PrayerRequestForm profileId={profile.id} missionaryName={profile.display_name} missionaryUserId={profile.user_id} />
      </div>
    </div>
  )
}
