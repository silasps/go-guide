import type { SupabaseClient } from '@supabase/supabase-js'
import type { HistoryBlock } from '@/types/history'
import type { PostWithProfile, Profile } from '@/types/database'
import { enrichWithEngagement } from '@/lib/posts/enrich-with-engagement'

type ProfileForPost = Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url' | 'accent_color' | 'user_role'>

/** Posts vinculados a itens da linha do tempo às vezes não estão entre os
 *  mais recentes já buscados pra grade do perfil — busca + enriquece só
 *  esses, pra abrir no PostDetailViewer igual a qualquer outro post. */
export async function getLinkedTimelinePosts(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  blocks: HistoryBlock[],
  profile: ProfileForPost,
  viewerUserId?: string | null
): Promise<PostWithProfile[]> {
  const postIds = new Set<string>()
  for (const block of blocks) {
    if (block.type !== 'timeline') continue
    const items = (block.content.items as { post_id?: string }[] | undefined) ?? []
    for (const item of items) {
      if (item.post_id) postIds.add(item.post_id)
    }
  }
  if (postIds.size === 0) return []

  const { data: posts } = await supabase
    .from('posts')
    .select('*, highlight:highlights(title, slug, category, cover_url)')
    .in('id', [...postIds])

  if (!posts || posts.length === 0) return []

  const engagement = await enrichWithEngagement(supabase, posts.map((p) => p.id), viewerUserId)
  return posts.map((post) => ({
    ...post,
    profile,
    ...engagement.get(post.id)!,
  })) as unknown as PostWithProfile[]
}
