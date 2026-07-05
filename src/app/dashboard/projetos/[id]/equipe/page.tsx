import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getActiveProfile } from '@/lib/profile/active-profile'
import { ProjectTeamPanel } from '@/components/highlights/project-team-panel'
import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ArrowLeft } from 'lucide-react'

interface Props { params: Promise<{ id: string }> }

export default async function ProjectTeamPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const profile = await getActiveProfile()
  if (!profile) notFound()

  const { data: highlight } = await supabase.from('highlights').select('id, title').eq('id', id).eq('profile_id', profile.id).single()
  if (!highlight) notFound()

  const { data: members } = await supabase.from('project_members').select('*').eq('highlight_id', id).order('joined_at')

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/dashboard/projetos/${id}`} className={cn(buttonVariants({ variant: 'ghost', size: 'icon-sm' }))}>
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-xl font-semibold">Equipe — {highlight.title}</h1>
          <p className="text-muted-foreground text-sm">Quem participa deste projeto e o financeiro compartilhado</p>
        </div>
      </div>
      <ProjectTeamPanel highlightId={id} members={members ?? []} />
    </div>
  )
}
