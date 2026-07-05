import { redirect } from 'next/navigation'
import { PostEditor } from '@/components/dashboard/post-editor'
import { createClient } from '@/lib/supabase/server'
import { getActiveProfile } from '@/lib/profile/active-profile'

export default async function NovaPublicacaoPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const profile = await getActiveProfile()

  if (!profile) redirect('/login')

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Nova publicação</h1>
        <p className="text-muted-foreground text-sm mt-1">Compartilhe uma atualização com seus parceiros</p>
      </div>
      <PostEditor profileId={profile.id} userId={user.id} />
    </div>
  )
}
