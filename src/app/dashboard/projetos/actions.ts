'use server'

import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'

function slugify(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

export async function saveHighlight(formData: {
  highlightId?: string
  profileId: string
  title: string
  description: string
  goalTypes: string[]
  goalAmount: number | null
  currentAmount: number
  currency: string
  coverUrl: string | null
  coverPosition: string
  scripture: string
  letter: string
  status: string
  milestones: Array<{ title: string; is_completed: boolean }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')

  const service = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const { data: profileRow } = await service
    .from('profiles')
    .select('id, user_id')
    .eq('id', formData.profileId)
    .single()
  if (!profileRow) throw new Error('Perfil não encontrado')

  let authorized = profileRow.user_id === user.id
  if (!authorized) {
    const { data: manager } = await service
      .from('profile_managers')
      .select('id')
      .eq('profile_id', formData.profileId)
      .eq('user_id', user.id)
      .eq('role', 'manager')
      .maybeSingle()
    authorized = Boolean(manager)
  }
  if (!authorized) throw new Error('Perfil não autorizado')

  const payload = {
    profile_id: formData.profileId,
    title: formData.title,
    description: formData.description || null,
    goal_type: formData.goalTypes.length > 0 ? formData.goalTypes : ['ongoing'],
    goal_amount: formData.goalAmount,
    current_amount: formData.currentAmount,
    currency: formData.currency,
    cover_url: formData.coverUrl,
    cover_position: formData.coverPosition,
    scripture: formData.scripture || null,
    letter: formData.letter || null,
    status: formData.status,
    slug: slugify(formData.title),
  }

  let highlightId = formData.highlightId

  if (highlightId) {
    const { error } = await service.from('highlights').update(payload).eq('id', highlightId)
    if (error) throw new Error(error.message)
  } else {
    const { data: last } = await service
      .from('highlights').select('order_index')
      .eq('profile_id', formData.profileId)
      .order('order_index', { ascending: false }).limit(1).single()
    const { data: created, error } = await service
      .from('highlights')
      .insert({ ...payload, order_index: (last?.order_index ?? -1) + 1 })
      .select('id').single()
    if (error) throw new Error(error.message)
    highlightId = created?.id
  }

  if (highlightId) {
    await service.from('milestones').delete().eq('highlight_id', highlightId)
    if (formData.milestones.length > 0) {
      const { error } = await service.from('milestones').insert(
        formData.milestones.map((m, i) => ({
          highlight_id: highlightId,
          profile_id: formData.profileId,
          title: m.title,
          is_completed: m.is_completed,
          completed_at: m.is_completed ? new Date().toISOString() : null,
          order_index: i,
        }))
      )
      if (error) throw new Error(error.message)
    }
  }

  revalidatePath('/dashboard/projetos')
}
