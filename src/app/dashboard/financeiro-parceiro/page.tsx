import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getTranslations } from 'next-intl/server'
import { GivingHistory } from '@/components/dashboard/partner/giving-history'

export default async function PartnerFinancePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const t = await getTranslations('PartnerFinance')

  const { data: pledges } = await supabase
    .from('pledges')
    .select('*, profile:profiles(id, display_name, username), highlight:highlights(title)')
    .eq('reporter_user_id', user.id)
    .order('reported_at', { ascending: false })

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">{t('pageTitle')}</h1>
      <GivingHistory pledges={pledges ?? []} />
    </div>
  )
}
