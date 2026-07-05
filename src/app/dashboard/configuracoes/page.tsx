import { createClient } from '@/lib/supabase/server'
import { getActiveProfile } from '@/lib/profile/active-profile'
import { SettingsTabs } from '@/components/dashboard/settings/settings-tabs'

export default async function ConfiguracoesPage() {
  const supabase = await createClient()
  const profile = await getActiveProfile()

  const { data: managers } = await supabase
    .from('profile_managers')
    .select('*')
    .eq('profile_id', profile!.id)
    .order('created_at')

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Configurações</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Gerencie seu perfil, pagamentos e privacidade.</p>
      </div>
      <SettingsTabs profile={profile!} managers={managers ?? []} />
    </div>
  )
}
