import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ArrowLeft } from 'lucide-react'
import { TrajectoryTimeline } from '@/components/profile/trajectory-timeline'
import type { Metadata } from 'next'

interface Props { params: Promise<{ username: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params
  return { title: `Trajetória — ${username}` }
}

export default async function TrajetoriaPage({ params }: Props) {
  const { username } = await params
  const supabase = await createClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, display_name, privacy_mode, mission_start_date')
    .eq('username', username)
    .single()

  if (!profile || profile.privacy_mode === 'stealth') notFound()

  const { data: projects } = await supabase
    .from('highlights')
    .select('id, slug, title, description, cover_url, cover_position, goal_amount, current_amount, currency, completed_at')
    .eq('profile_id', profile.id)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })

  const missionStartYear = profile.mission_start_date ? new Date(profile.mission_start_date).getFullYear() : null

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <Link href={`/${username}`} className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'gap-1.5 -ml-2 text-muted-foreground')}>
          <ArrowLeft className="h-4 w-4" />
          {profile.display_name}
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Trajetória de {profile.display_name}</h1>
          <p className="text-muted-foreground mt-1">
            {missionStartYear ? `Em missão desde ${missionStartYear}. ` : ''}
            Projetos e desafios já concluídos ao longo do caminho.
          </p>
        </div>
        <TrajectoryTimeline username={username} projects={projects ?? []} />
      </div>
    </div>
  )
}
