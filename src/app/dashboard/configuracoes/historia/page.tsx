import { getActiveProfile } from '@/lib/profile/active-profile'
import { createClient } from '@/lib/supabase/server'
import { getTranslations } from 'next-intl/server'
import { HistoryEditorForm } from '@/components/dashboard/settings/history-editor-form'
import { BackButton } from '@/components/ui/back-button'

export default async function HistoriaSettingsPage() {
  const profile = await getActiveProfile()
  const supabase = await createClient()
  const t = await getTranslations('HistoryEditor')

  const { data: blocks } = await supabase
    .from('history_blocks')
    .select('*')
    .eq('profile_id', profile!.id)
    .order('order_index')

  return (
    <div className="space-y-6 max-w-lg mx-auto">
      <div className="flex items-center gap-2">
        <BackButton href="/dashboard/configuracoes" label={t('back')} />
        <h1 className="text-xl font-semibold">{t('title')}</h1>
      </div>
      <HistoryEditorForm profileId={profile!.id} blocks={blocks ?? []} backPath="/dashboard/configuracoes" />
    </div>
  )
}
