import { createClient } from '@/lib/supabase/server'
import { getActiveProfile } from '@/lib/profile/active-profile'
import { ReconciliationQueue } from '@/components/financial/reconciliation-queue'

export default async function ConciliacaoPage() {
  const supabase = await createClient()
  const profile = await getActiveProfile()

  const { data: pledges } = await supabase
    .from('pledges')
    .select('*, highlight:highlights(title)')
    .eq('profile_id', profile!.id)
    .eq('status', 'pending')
    .order('reported_at', { ascending: false })

  const { data: accounts } = await supabase.from('financial_accounts').select('*').order('created_at')

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {pledges?.length ?? 0} oferta(s) aguardando confirmação
      </p>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <ReconciliationQueue pledges={(pledges ?? []) as any} accounts={accounts ?? []} profileId={profile!.id} />
    </div>
  )
}
