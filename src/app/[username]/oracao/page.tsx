import { notFound } from 'next/navigation'
import Link from 'next/link'
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
        <Link href={`/${username}`} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
          ← Voltar ao perfil de {profile.display_name}
        </Link>
        <div className="text-center">
          <h1 className="text-2xl font-bold">Orar por {profile.display_name}</h1>
          <p className="text-muted-foreground mt-2">Envie uma palavra de oração e incentivo para fortalecer essa missão.</p>
        </div>
        <PrayerRequestForm profileId={profile.id} username={username} missionaryName={profile.display_name} missionaryUserId={profile.user_id} />
      </div>
    </div>
  )
}
