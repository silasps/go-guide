import { createClient } from '@/lib/supabase/server'
import { getActiveProfile } from '@/lib/profile/active-profile'
import { PrayerInbox } from '@/components/prayer/prayer-inbox'
import { NewPrayerButton } from '@/components/prayer/new-prayer-button'
import { E2EEGate } from '@/components/messages/e2ee-gate'

export default async function OracoesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const profile = await getActiveProfile()

  const { data: requests } = await supabase
    .from('prayer_requests')
    .select('*')
    .eq('profile_id', profile!.id)
    .order('created_at', { ascending: false })

  const hasPrivate = (requests ?? []).some(r => r.is_private)

  const inbox = <PrayerInbox requests={requests ?? []} myUserId={user!.id} />

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Pedidos de Oração</h1>
          <p className="text-muted-foreground text-sm mt-1">Seus pedidos e os pedidos dos parceiros</p>
        </div>
        <NewPrayerButton profileId={profile!.id} />
      </div>
      {hasPrivate ? <E2EEGate userId={user!.id}>{inbox}</E2EEGate> : inbox}
    </div>
  )
}
