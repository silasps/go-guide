import { createClient } from '@/lib/supabase/server'
import { getActiveProfile } from '@/lib/profile/active-profile'
import { markNotificationTypesRead } from '@/lib/notifications/mark-read'
import { PartnersList } from '@/components/partners/partners-list'
import { AddPartnerButton } from '@/components/partners/add-partner-button'

export default async function ParceirosPage() {
  const supabase = await createClient()
  const [{ data: { user } }, profile] = await Promise.all([
    supabase.auth.getUser(),
    getActiveProfile(),
  ])

  const [, { data: partners }, { data: grants }] = await Promise.all([
    markNotificationTypesRead(supabase, user!.id, ['new_partner']),
    supabase.from('partners').select('*').eq('profile_id', profile!.id).order('joined_at', { ascending: false }),
    supabase.from('partner_visibility_grants').select('partner_id, section').eq('profile_id', profile!.id),
  ])

  const grantsByPartner: Record<string, string[]> = {}
  for (const g of grants ?? []) {
    grantsByPartner[g.partner_id] = [...(grantsByPartner[g.partner_id] ?? []), g.section]
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Parceiros</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{partners?.length ?? 0} parceiro(s) cadastrado(s)</p>
        </div>
        <AddPartnerButton profileId={profile!.id} plan={profile!.plan} partnerCount={partners?.length ?? 0} />
      </div>
      <PartnersList partners={partners ?? []} profileId={profile!.id} grantsByPartner={grantsByPartner} />
    </div>
  )
}
