import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Plus } from 'lucide-react'
import { HighlightsList } from '@/components/highlights/highlights-list'

export default async function ProjetosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, username')
    .eq('user_id', user!.id)
    .single()

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
        <Link href="/dashboard/projetos/novo" className={cn(buttonVariants(), 'gap-2 shrink-0')}>
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Novo projeto</span>
        </Link>
      </div>
      <HighlightsList highlights={highlights ?? []} basePath="/dashboard/projetos" username={profile!.username} />
    </div>
  )
}
