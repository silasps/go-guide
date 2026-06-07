import { createClient } from '@/lib/supabase/server'
import { HighlightForm } from '@/components/highlights/highlight-form'

export default async function NovoDestaquePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('id').eq('user_id', user!.id).single()

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Novo destaque</h1>
      <HighlightForm profileId={profile!.id} />
    </div>
  )
}
