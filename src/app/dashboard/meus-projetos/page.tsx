import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getTranslations } from 'next-intl/server'
import { MyProjectsList } from '@/components/dashboard/partner/my-projects-list'

export default async function MyProjectsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const t = await getTranslations('PartnerFinance')

  const [{ data: pledged }, { data: recurring }] = await Promise.all([
    supabase.from('pledges').select('highlight_id').eq('reporter_user_id', user.id).eq('status', 'confirmed').not('highlight_id', 'is', null),
    supabase.from('recurring_pledges').select('highlight_id').eq('reporter_user_id', user.id).eq('status', 'active').not('highlight_id', 'is', null),
  ])

  const highlightIds = Array.from(new Set([
    ...(pledged ?? []).map((p) => p.highlight_id as string),
    ...(recurring ?? []).map((r) => r.highlight_id as string),
  ]))

  const { data: highlights } = highlightIds.length > 0
    ? await supabase
        .from('highlights')
        .select('*, profile:profiles(id, username, display_name, accent_color)')
        .in('id', highlightIds)
    : { data: [] }

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">{t('myProjectsTitle')}</h1>
      <MyProjectsList projects={highlights ?? []} />
    </div>
  )
}
