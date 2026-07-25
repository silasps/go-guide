'use server'

import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient, SupabaseClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import type { HighlightStatus, Locale, MediaAspectRatio, PostType } from '@/types/database'

function serviceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

async function assertProfileAccess(service: SupabaseClient, profileId: string, userId: string) {
  const { data: profileRow } = await service
    .from('profiles')
    .select('id, user_id')
    .eq('id', profileId)
    .single()
  if (!profileRow) throw new Error('Perfil não encontrado')

  let authorized = profileRow.user_id === userId
  if (!authorized) {
    const { data: manager } = await service
      .from('profile_managers')
      .select('id')
      .eq('profile_id', profileId)
      .eq('user_id', userId)
      .eq('role', 'manager')
      .maybeSingle()
    authorized = Boolean(manager)
  }
  if (!authorized) throw new Error('Perfil não autorizado')
}

export async function savePost(input: {
  postId?: string
  profileId: string
  originalLocale: Locale
  type: PostType
  content: string
  mediaUrls: string[]
  mediaAspectRatio?: MediaAspectRatio
  location?: string | null
  isDraft: boolean
  scheduledAt?: string | null
  projectId?: string | null
  translations: Partial<Record<Locale, { content: string; source: 'ai' | 'human' }>>
  tags?: { mediaIndex: number; taggedProfileId: string; x: number; y: number }[]
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')

  const service = serviceClient()
  await assertProfileAccess(service, input.profileId, user.id)

  if (input.projectId) {
    const { data: highlightRow } = await service
      .from('highlights')
      .select('id')
      .eq('id', input.projectId)
      .eq('profile_id', input.profileId)
      .maybeSingle()
    if (!highlightRow) throw new Error('Projeto não encontrado')
  }

  const translations = Object.fromEntries(
    Object.entries(input.translations)
      .filter(([locale, t]) => locale !== input.originalLocale && t?.content.trim())
      .map(([locale, t]) => [
        locale,
        { content: t!.content.trim(), source: t!.source, translated_at: new Date().toISOString() },
      ])
  )

  // Agendado = não é rascunho, tem data futura e ainda não foi publicado.
  // O cron de /api/cron/publish-scheduled-posts promove para published_at
  // quando a hora chega — aqui só guardamos a intenção.
  const isScheduled = !input.isDraft && !!input.scheduledAt && new Date(input.scheduledAt) > new Date()

  const payload = {
    profile_id: input.profileId,
    created_by_user_id: user.id,
    type: input.type,
    content: input.content.trim() || null,
    media_urls: input.mediaUrls,
    media_aspect_ratio: input.mediaAspectRatio ?? '4:5',
    location: input.location?.trim() || null,
    is_draft: input.isDraft,
    published_at: input.isDraft || isScheduled ? null : new Date().toISOString(),
    scheduled_at: isScheduled ? input.scheduledAt : null,
    project_id: input.projectId ?? null,
    translations,
  }

  let postId = input.postId
  if (postId) {
    const { error } = await service.from('posts').update(payload).eq('id', postId)
    if (error) throw new Error(error.message)
  } else {
    const { data, error } = await service
      .from('posts')
      .insert({ ...payload, original_locale: input.originalLocale })
      .select('id')
      .single()
    if (error) throw new Error(error.message)
    postId = data.id
  }

  if (input.tags) {
    await service.from('post_tags').delete().eq('post_id', postId)
    if (input.tags.length) {
      const { error } = await service.from('post_tags').insert(
        input.tags.map((tag) => ({
          post_id: postId,
          media_index: tag.mediaIndex,
          tagged_profile_id: tag.taggedProfileId,
          position_x: tag.x,
          position_y: tag.y,
          created_by_user_id: user.id,
        }))
      )
      if (error) throw new Error(error.message)
    }
  }

  revalidatePath('/dashboard/publicacoes')
  revalidatePath('/dashboard/feed')
}

export async function getLinkableProjects(profileId: string): Promise<{
  id: string
  title: string
  slug: string | null
  cover_url: string | null
  status: HighlightStatus
}[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')

  const service = serviceClient()
  await assertProfileAccess(service, profileId, user.id)

  const { data } = await service
    .from('highlights')
    .select('id, title, slug, cover_url, status')
    .eq('profile_id', profileId)
    .in('status', ['active', 'completed'])
    .order('order_index')

  return data ?? []
}
