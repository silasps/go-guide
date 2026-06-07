import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { HighlightForm } from '@/components/highlights/highlight-form'

interface Props { params: Promise<{ id: string }> }

export default async function EditarDestaquePage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('id').eq('user_id', user!.id).single()
  const { data: highlight } = await supabase.from('highlights').select('*').eq('id', id).eq('profile_id', profile!.id).single()
  if (!highlight) notFound()

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Editar destaque</h1>
      <HighlightForm highlight={highlight} profileId={profile!.id} />
    </div>
  )
}
