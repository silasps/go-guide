import { createClient } from '@/lib/supabase/server'
import { getActiveProfile } from '@/lib/profile/active-profile'
import { markNotificationTypesRead } from '@/lib/notifications/mark-read'
import { PostsList } from '@/components/dashboard/posts-list'
import { NewPostButton } from '@/components/dashboard/new-post-button'

export default async function PublicacoesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const profile = await getActiveProfile()

  await markNotificationTypesRead(supabase, user!.id, ['new_post', 'highlight_update'])

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
        <NewPostButton />
      </div>

      <PostsList posts={posts ?? []} />
    </div>
  )
}
