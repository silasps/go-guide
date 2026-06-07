import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Plus } from 'lucide-react'
import { PostsList } from '@/components/dashboard/posts-list'

export default async function PublicacoesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, plan')
    .eq('user_id', user!.id)
    .single()

  const { data: posts } = await supabase
    .from('posts')
    .select('*')
    .eq('profile_id', profile!.id)
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Publicações</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Gerencie seu conteúdo missionário</p>
        </div>
        <Link href="/dashboard/publicacoes/nova" className={cn(buttonVariants(), 'gap-2 shrink-0')}>
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Nova publicação</span>
        </Link>
      </div>

      <PostsList posts={posts ?? []} />
    </div>
  )
}
