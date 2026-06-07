import { createClient } from '@/lib/supabase/server'
import { PrayerInbox } from '@/components/prayer/prayer-inbox'
import { NewPrayerButton } from '@/components/prayer/new-prayer-button'

export default async function OracoesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('id').eq('user_id', user!.id).single()

  const { data: requests } = await supabase
    .from('prayer_requests')
    .select('*')
    .eq('profile_id', profile!.id)
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Pedidos de Oração</h1>
          <p className="text-muted-foreground text-sm mt-1">Seus pedidos e os pedidos dos parceiros</p>
        </div>
        <NewPrayerButton profileId={profile!.id} />
      </div>
      <PrayerInbox requests={requests ?? []} profileId={profile!.id} />
    </div>
  )
}
