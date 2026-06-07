import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PartnershipForm } from '@/components/partners/partnership-form'

interface Props { params: Promise<{ username: string }> }

export default async function ParceriaPage({ params }: Props) {
  const { username } = await params
  const supabase = await createClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, display_name, privacy_mode')
    .eq('username', username)
    .single()

  if (!profile || profile.privacy_mode === 'stealth') notFound()

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Seja parceiro de {profile.display_name}</h1>
          <p className="text-muted-foreground mt-2">Preencha seus dados para começar a acompanhar esta missão.</p>
        </div>
        <PartnershipForm profileId={profile.id} missionaryName={profile.display_name} />
      </div>
    </div>
  )
}
