import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { HistoryView } from '@/components/profile/history-view'
import { SkList } from '@/components/ui/skeleton'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { getProfile } from '@/lib/profile/get-profile'
import { getProfileViewerContext } from '@/lib/profile/viewer-context'
import { Pencil } from 'lucide-react'

interface Props { params: Promise<{ username: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params
  const profile = await getProfile(username)
  if (!profile || profile.privacy_mode === 'stealth') return {}

  const t = await getTranslations('PublicProfile')
  const isIndexable = profile.privacy_mode === 'public'
  const title = t('historiaTitle', { name: profile.display_name })
  const description = t('historiaDescription', { name: profile.display_name })

  return {
    title,
    description,
    openGraph: isIndexable ? { title, description, images: profile.avatar_url ? [profile.avatar_url] : [] } : undefined,
    robots: isIndexable ? undefined : { index: false, follow: false },
  }
}

export default async function HistoriaPage({ params }: Props) {
  const { username } = await params
  const profile = await getProfile(username)

  if (!profile || profile.privacy_mode === 'stealth') notFound()

  const t = await getTranslations('PublicProfile')
  const { canEdit } = await getProfileViewerContext(username)

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-8 pb-20 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">História de {profile.display_name}</h1>
          <p className="text-muted-foreground text-sm mt-1">A jornada por trás da missão.</p>
        </div>
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
