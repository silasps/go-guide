import { createClient } from '@/lib/supabase/server'
import { getActiveProfile } from '@/lib/profile/active-profile'
import { SettingsTabs } from '@/components/dashboard/settings/settings-tabs'
import { getTranslations } from 'next-intl/server'

export default async function ConfiguracoesPage() {
  const supabase = await createClient()
  const profile = await getActiveProfile()
  const t = await getTranslations('SettingsPage')

  const { data: managers } = await supabase
    .from('profile_managers')
    .select('*')
    .eq('profile_id', profile!.id)
    .order('created_at')

  const { data: paymentMethods } = await supabase
    .from('payment_methods')
    .select('*')
    .eq('profile_id', profile!.id)
    .order('sort_order')

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold">{t('title')}</h1>
        <p className="text-muted-foreground text-sm mt-0.5">{t('subtitle')}</p>
      </div>
      <SettingsTabs profile={profile!} managers={managers ?? []} paymentMethods={paymentMethods ?? []} />
    </div>
  )
}
