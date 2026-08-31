import { createClient } from '@/lib/supabase/server'
import { getActiveProfile } from '@/lib/profile/active-profile'
import { BackButton } from '@/components/ui/back-button'
import { ArchivedProjectsList } from '@/components/highlights/archived-projects-list'

export default async function ProjetosArquivadosPage() {
  const supabase = await createClient()
  const profile = await getActiveProfile()

  const { data: highlights } = await supabase
    .from('highlights')
    .select('*')
    .eq('profile_id', profile!.id)
    .not('archived_at', 'is', null)
    .order('archived_at', { ascending: false })

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <BackButton href="/dashboard/projetos" label="Voltar" />
        <div>
          <h1 className="font-heading text-xl font-semibold">Projetos arquivados</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Ficam fora da listagem e da página pública, mas o histórico continua guardado aqui.</p>
        </div>
      </div>
      <ArchivedProjectsList highlights={highlights ?? []} />
    </div>
  )
}
