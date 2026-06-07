import { createClient } from '@/lib/supabase/server'
import { SettingsTabs } from '@/components/dashboard/settings/settings-tabs'

export default async function ConfiguracoesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', user!.id)
    .single()

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Configurações</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Gerencie seu perfil, pagamentos e privacidade.</p>
      </div>
      <SettingsTabs profile={profile!} />
    </div>
  )
}
