'use server'

import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import type { Locale, PostType } from '@/types/database'

export async function savePost(input: {
  postId?: string
  profileId: string
  originalLocale: Locale
  type: PostType
  content: string
  mediaUrls: string[]
  isDraft: boolean
  translations: Partial<Record<Locale, { content: string; source: 'ai' | 'human' }>>
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
    .eq('id', input.profileId)
    .single()
  if (!profileRow) throw new Error('Perfil não encontrado')

  let authorized = profileRow.user_id === user.id
  if (!authorized) {
    const { data: manager } = await service
      .from('profile_managers')
      .select('id')
      .eq('profile_id', input.profileId)
      .eq('user_id', user.id)
      .eq('role', 'manager')
      .maybeSingle()
    authorized = Boolean(manager)
  }
  if (!authorized) throw new Error('Perfil não autorizado')

  const translations = Object.fromEntries(
    Object.entries(input.translations)
      .filter(([locale, t]) => locale !== input.originalLocale && t?.content.trim())
      .map(([locale, t]) => [
        locale,
        { content: t!.content.trim(), source: t!.source, translated_at: new Date().toISOString() },
      ])
  )

  const payload = {
    profile_id: input.profileId,
    created_by_user_id: user.id,
    type: input.type,
    content: input.content.trim() || null,
    media_urls: input.mediaUrls,
    is_draft: input.isDraft,
    published_at: input.isDraft ? null : new Date().toISOString(),
    translations,
  }

  if (input.postId) {
    const { error } = await service.from('posts').update(payload).eq('id', input.postId)
    if (error) throw new Error(error.message)
  } else {
    const { error } = await service
      .from('posts')
      .insert({ ...payload, original_locale: input.originalLocale })
    if (error) throw new Error(error.message)
  }

  revalidatePath('/dashboard/publicacoes')
}
