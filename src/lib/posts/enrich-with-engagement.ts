import type { SupabaseClient } from '@supabase/supabase-js'
import type { PostTagWithProfile } from '@/types/database'

export interface PostEngagement {
  like_count: number
  comment_count: number
  share_count: number
  viewer_has_liked: boolean
  tags: PostTagWithProfile[]
}

const EMPTY: PostEngagement = { like_count: 0, comment_count: 0, share_count: 0, viewer_has_liked: false, tags: [] }

/** Busca curtidas/comentários/compartilhamentos/marcações de um lote de
 *  posts numa única rodada de queries e devolve um mapa
 *  `postId -> PostEngagement`, para quem monta a lista mesclar em cada
 *  post sem esperar per-row. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function enrichWithEngagement(supabase: SupabaseClient<any>, postIds: string[], viewerUserId?: string | null): Promise<Map<string, PostEngagement>> {
  const map = new Map<string, PostEngagement>()
  if (postIds.length === 0) return map

  const [{ data: likes }, { data: comments }, { data: shares }, { data: tags }, viewerProfile] = await Promise.all([
    supabase.from('post_likes').select('post_id, profile_id').in('post_id', postIds),
    supabase.from('post_comments').select('post_id').in('post_id', postIds).is('deleted_at', null),
    supabase.from('post_shares').select('post_id').in('post_id', postIds),
    supabase.from('post_tags').select('id, post_id, media_index, tagged_profile_id, position_x, position_y, created_by_user_id, created_at, profile:profiles!post_tags_tagged_profile_id_fkey(id, username, display_name)').in('post_id', postIds),
    viewerUserId
      ? supabase.from('profiles').select('id').eq('user_id', viewerUserId).maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  const viewerProfileId = viewerProfile?.data?.id ?? null

  for (const id of postIds) map.set(id, { ...EMPTY, tags: [] })

  for (const like of likes ?? []) {
    const entry = map.get(like.post_id)
    if (!entry) continue
    entry.like_count += 1
    if (viewerProfileId && like.profile_id === viewerProfileId) entry.viewer_has_liked = true
  }

  for (const comment of comments ?? []) {
    const entry = map.get(comment.post_id)
    if (entry) entry.comment_count += 1
  }

  for (const share of shares ?? []) {
    const entry = map.get(share.post_id)
    if (entry) entry.share_count += 1
  }

  for (const tag of tags ?? []) {
    const entry = map.get(tag.post_id)
    if (entry) entry.tags.push(tag as unknown as PostTagWithProfile)
  }

  return map
}
