'use server'

import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient, SupabaseClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import type { HighlightStatus, Locale, MediaAspectRatio, PostType } from '@/types/database'
import { getNearbyLocationsCascade, searchLocationsCascade } from '@/lib/geocoding/cascade'

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
  mediaBunnyVideoId?: string | null
  mediaStatus?: 'ready' | 'processing' | 'failed'
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
    media_bunny_video_id: input.mediaBunnyVideoId ?? null,
    media_status: input.mediaStatus ?? 'ready',
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

/** Sugestões de localização pro passo de detalhes do composer — sem
 *  serviço externo de geocoding (custo/chave de API), só reaproveita
 *  localizações que o próprio missionário já usou: a do perfil e as dos
 *  últimos posts com localização preenchida. */
export async function getLocationSuggestions(profileId: string): Promise<string[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')

  const service = serviceClient()
  await assertProfileAccess(service, profileId, user.id)

  const [{ data: profile }, { data: posts }] = await Promise.all([
    service.from('profiles').select('location').eq('id', profileId).maybeSingle(),
    service
      .from('posts')
      .select('location')
      .eq('profile_id', profileId)
      .not('location', 'is', null)
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  const seen = new Set<string>()
  const suggestions: string[] = []
  for (const loc of [profile?.location, ...(posts ?? []).map((p) => p.location)]) {
    if (!loc || seen.has(loc)) continue
    seen.add(loc)
    suggestions.push(loc)
    if (suggestions.length >= 5) break
  }
  return suggestions
}

/** Autocomplete de localização mundo afora, estilo Instagram — cascata
 *  Mapbox -> Photon (ver `src/lib/geocoding/cascade.ts` pra lógica de
 *  fallback e `system.architecture.md` Changelog pro histórico da
 *  decisão). */
export async function searchLocations(query: string): Promise<string[]> {
  return searchLocationsCascade(query)
}

/** Sugestões de localização perto de onde o usuário está agora, estilo
 *  Instagram (o picker de localização já abre com lugares próximos — igreja,
 *  mercado, empresa etc. — antes de digitar nada) a partir de lat/lon lidos
 *  no browser (`navigator.geolocation`, client-side em `StepDetails`) —
 *  cascata Google Places -> Mapbox -> Photon (ver `src/lib/geocoding/
 *  cascade.ts`). */
export async function getNearbyLocations(lat: number, lon: number): Promise<string[]> {
  return getNearbyLocationsCascade(lat, lon)
}
