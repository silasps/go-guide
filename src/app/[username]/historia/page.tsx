import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { HistoryView } from '@/components/profile/history-view'
import { ProfileHeader } from '@/components/profile/profile-header'
import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ArrowLeft } from 'lucide-react'

interface Props { params: Promise<{ username: string }> }

export default async function HistoriaPage({ params }: Props) {
  const { username } = await params
  const supabase = await createClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('username', username)
    .single()

  if (!profile || profile.privacy_mode === 'stealth') notFound()

  const { data: blocks } = await supabase
    .from('history_blocks')
    .select('*')
    .eq('profile_id', profile.id)
    .order('order_index')

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto pb-20">
        <div className="px-4 pt-4">
          <Link href={`/${username}`} className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'gap-1.5 -ml-2 mb-4')}>
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Link>
        </div>
        <ProfileHeader profile={profile} />
        <HistoryView blocks={blocks ?? []} />
      </div>
    </div>
  )
}
