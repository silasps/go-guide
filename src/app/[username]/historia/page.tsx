import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { HistoryView } from '@/components/profile/history-view'
import { ProfileHeader } from '@/components/profile/profile-header'
import { SkList } from '@/components/ui/skeleton'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { getProfile } from '@/lib/profile/get-profile'
import { getProfileViewerContext } from '@/lib/profile/viewer-context'
import { Pencil } from 'lucide-react'

interface Props { params: Promise<{ username: string }> }

export default async function HistoriaPage({ params }: Props) {
  const { username } = await params
  const profile = await getProfile(username)

  if (!profile || profile.privacy_mode === 'stealth') notFound()

  const supabase = await createClient()
  const t = await getTranslations('PublicProfile')
  const [{ count: postsCount }, { count: projectsCount }, { count: achievementsCount }, { canEdit }] = await Promise.all([
    supabase.from('posts').select('id', { count: 'exact', head: true }).eq('profile_id', profile.id).eq('is_draft', false),
    supabase.from('highlights').select('id', { count: 'exact', head: true }).eq('profile_id', profile.id).eq('status', 'active'),
    supabase.from('highlights').select('id', { count: 'exact', head: true }).eq('profile_id', profile.id).eq('status', 'completed'),
    getProfileViewerContext(username),
  ])

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-8 pb-20 space-y-6">
        <ProfileHeader
          profile={profile}
          postsCount={postsCount ?? 0}
          projectsCount={projectsCount ?? 0}
          achievementsCount={achievementsCount ?? 0}
        />
        {canEdit && (
          <Link href="/dashboard/configuracoes/historia" className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'gap-2')}>
            <Pencil className="h-3.5 w-3.5" />
            {t('editHistory')}
          </Link>
        )}
        <Suspense fallback={<SkList n={3} />}>
          <HistoryBlocksAsync profileId={profile.id} />
        </Suspense>
      </div>
    </div>
  )
}

async function HistoryBlocksAsync({ profileId }: { profileId: string }) {
  const supabase = await createClient()
  const { data: blocks } = await supabase
    .from('history_blocks')
    .select('*')
    .eq('profile_id', profileId)
    .order('order_index')

  return <HistoryView blocks={blocks ?? []} />
}
