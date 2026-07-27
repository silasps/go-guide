import { createClient } from '@/lib/supabase/server'
import { getActiveProfile } from '@/lib/profile/active-profile'
import { HighlightsList } from '@/components/highlights/highlights-list'
import { NewProjectButton } from '@/components/highlights/project-composer/new-project-triggers'

export default async function ProjetosPage() {
  const supabase = await createClient()
  const profile = await getActiveProfile()

  const { data: highlights } = await supabase
    .from('highlights')
    .select('*')
    .eq('profile_id', profile!.id)
    .order('order_index')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Projetos</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Missões, obras e campanhas em andamento</p>
        </div>
        <NewProjectButton label="Novo projeto" className="hidden md:inline-flex shrink-0" />
      </div>
      <HighlightsList highlights={highlights ?? []} basePath="/dashboard/projetos" username={profile!.username} />
    </div>
  )
}
