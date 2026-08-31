import Link from 'next/link'
import { Archive } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getActiveProfile } from '@/lib/profile/active-profile'
import { HighlightsList } from '@/components/highlights/highlights-list'
import { NewProjectButton } from '@/components/highlights/project-composer/new-project-triggers'

export default async function ProjetosPage() {
  const supabase = await createClient()
  const profile = await getActiveProfile()

  const [{ data: highlights }, { count: archivedCount }] = await Promise.all([
    supabase
      .from('highlights')
      .select('*')
      .eq('profile_id', profile!.id)
      .is('archived_at', null)
      .order('order_index'),
    supabase
      .from('highlights')
      .select('id', { count: 'exact', head: true })
      .eq('profile_id', profile!.id)
      .not('archived_at', 'is', null),
  ])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-xl font-semibold">Projetos</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Missões, obras e campanhas em andamento</p>
        </div>
        <NewProjectButton label="Novo projeto" className="hidden md:inline-flex shrink-0" />
      </div>
      <HighlightsList highlights={highlights ?? []} basePath="/dashboard/projetos" username={profile!.username} />
      {!!archivedCount && (
        <Link href="/dashboard/projetos/arquivados" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <Archive className="h-3.5 w-3.5" />
          Ver projetos arquivados ({archivedCount})
        </Link>
      )}
    </div>
  )
}
