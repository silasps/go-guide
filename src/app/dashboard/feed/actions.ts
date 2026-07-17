'use server'

import { createClient } from '@/lib/supabase/server'
import { PostWithProfile, ProjectStory, StoryPost } from '@/types/database'
import { scorePost, AffinitySignals } from '@/lib/feed/rank'

const PAGE_SIZE = 15
const STORY_POSTS_PER_PROJECT = 10

export async function getFeedPage(cursor: string | null): Promise<{
  posts: PostWithProfile[]
  nextCursor: string | null
}> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { posts: [], nextCursor: null }

  const [{ data: follows }, { data: partners }, { data: pledges }, { data: recurring }] = await Promise.all([
    supabase.from('follows').select('profile_id').eq('follower_user_id', user.id),
    supabase.from('partners').select('profile_id').eq('user_id', user.id),
    supabase.from('pledges').select('profile_id, highlight:highlights(category)').eq('reporter_user_id', user.id).eq('status', 'confirmed'),
    supabase.from('recurring_pledges').select('profile_id').eq('reporter_user_id', user.id).eq('status', 'active'),
  ])

  const followedProfileIds = new Set((follows ?? []).map((f) => f.profile_id))
  const pledgedProfileIds = new Set((pledges ?? []).map((p) => p.profile_id))
  const activeRecurringProfileIds = new Set((recurring ?? []).map((r) => r.profile_id))
  const affinityCategories = new Set(
    (pledges ?? []).flatMap((p) => (p.highlight as { category?: string[] } | null)?.category ?? [])
  ) as AffinitySignals['affinityCategories']

  const profileIds = new Set<string>([
    ...followedProfileIds,
    ...(partners ?? []).map((p) => p.profile_id),
  ])

  if (profileIds.size === 0) {
    return { posts: [], nextCursor: null }
  }

  let query = supabase
    .from('posts')
    .select('*, profile:profiles(id, username, display_name, avatar_url, accent_color), highlight:highlights(title, slug, category)')
    .in('profile_id', Array.from(profileIds))
    .eq('is_draft', false)
    .order('published_at', { ascending: false })
    .limit(PAGE_SIZE)

  if (cursor) query = query.lt('published_at', cursor)

  const { data: posts } = await query
  const list = (posts ?? []) as unknown as PostWithProfile[]

  const signals: AffinitySignals = { followedProfileIds, pledgedProfileIds, activeRecurringProfileIds, affinityCategories }
  const ranked = [...list].sort((a, b) => scorePost(b, signals) - scorePost(a, signals))

  if (ranked.length > 0) {
    await supabase.from('feed_events').insert(
      ranked.map((p) => ({ actor_user_id: user.id, event_type: 'post_view' as const, profile_id: p.profile_id, post_id: p.id }))
    )
  }

  const nextCursor = list.length === PAGE_SIZE ? list[list.length - 1].published_at : null
  return { posts: ranked, nextCursor }
}

export async function followProfile(profileId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'not_authenticated' }

  const { error } = await supabase.from('follows').insert({ follower_user_id: user.id, profile_id: profileId })
  if (error && error.code !== '23505') return { error: error.message }

  await supabase.from('feed_events').insert({ actor_user_id: user.id, event_type: 'follow', profile_id: profileId })
  return { error: null }
}

export async function unfollowProfile(profileId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'not_authenticated' }

  const { error } = await supabase.from('follows').delete().eq('follower_user_id', user.id).eq('profile_id', profileId)
  if (error) return { error: error.message }

  await supabase.from('feed_events').insert({ actor_user_id: user.id, event_type: 'unfollow', profile_id: profileId })
  return { error: null }
}

export async function getDiscoverMissionaries() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let query = supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, accent_color, bio')
    .eq('privacy_mode', 'public')
    .eq('user_role', 'missionary')
    .order('created_at', { ascending: false })
    .limit(20)

  if (user) query = query.neq('user_id', user.id)

  const { data } = await query
  return data ?? []
}

// Faixa de "stories" do feed: projetos ativos de quem o usuário segue/apoia
// que têm ao menos uma atualização (posts.project_id), ordenados pela
// atualização mais recente. Reaproveita o mesmo posts/highlights já usados
// em projetos/[slug] — não existe conteúdo de "story" separado, só o
// rastreio de visto/não visto (project_story_views, migration 035).
export async function getFollowedProjectStories(): Promise<ProjectStory[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const [{ data: follows }, { data: partners }] = await Promise.all([
    supabase.from('follows').select('profile_id').eq('follower_user_id', user.id),
    supabase.from('partners').select('profile_id').eq('user_id', user.id),
  ])

  const profileIds = new Set<string>([
    ...(follows ?? []).map((f) => f.profile_id),
    ...(partners ?? []).map((p) => p.profile_id),
  ])
  if (profileIds.size === 0) return []

  const { data: highlights } = await supabase
    .from('highlights')
    .select('id, title, slug, cover_url, cover_position, profile:profiles(id, username, display_name, accent_color)')
    .in('profile_id', Array.from(profileIds))
    .eq('status', 'active')

  if (!highlights?.length) return []
  const highlightIds = highlights.map((h) => h.id)

  const [{ data: posts }, { data: views }] = await Promise.all([
    supabase
      .from('posts')
      .select('id, project_id, content, media_urls, type, published_at, original_locale, translations')
      .in('project_id', highlightIds)
      .eq('is_draft', false)
      .order('published_at', { ascending: false })
      .limit(300),
    supabase.from('project_story_views').select('highlight_id, last_viewed_at').eq('user_id', user.id),
  ])

  const viewedMap = new Map((views ?? []).map((v) => [v.highlight_id, v.last_viewed_at]))

  // posts já vem ordenado desc; agrupa mantendo essa ordem e trunca por
  // projeto — evita que um projeto muito ativo consuma o limite global.
  const postsByHighlight = new Map<string, (StoryPost & { project_id: string | null })[]>()
  for (const post of posts ?? []) {
    const list = postsByHighlight.get(post.project_id!) ?? []
    if (list.length < STORY_POSTS_PER_PROJECT) list.push(post)
    postsByHighlight.set(post.project_id!, list)
  }

  const stories = highlights
    .map((h) => {
      const newestFirst = postsByHighlight.get(h.id) ?? []
      if (newestFirst.length === 0) return null
      const lastViewedAt = viewedMap.get(h.id)
      const latestPublishedAt = newestFirst[0].published_at!
      const story: ProjectStory & { latestPublishedAt: string } = {
        highlight: { id: h.id, title: h.title, slug: h.slug, cover_url: h.cover_url, cover_position: h.cover_position },
        profile: h.profile as unknown as ProjectStory['profile'],
        posts: [...newestFirst].reverse(), // cronológico (mais antigo primeiro) pro visualizador
        hasUnseen: !lastViewedAt || lastViewedAt < latestPublishedAt,
        latestPublishedAt,
      }
      return story
    })
    .filter((s): s is ProjectStory & { latestPublishedAt: string } => s !== null)
    .sort((a, b) => (a.latestPublishedAt < b.latestPublishedAt ? 1 : -1))

  return stories
}

export async function markProjectStoryViewed(highlightId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  await supabase
    .from('project_story_views')
    .upsert(
      { user_id: user.id, highlight_id: highlightId, last_viewed_at: new Date().toISOString() },
      { onConflict: 'user_id,highlight_id' }
    )
}

export async function getFollowedProfileIds(): Promise<string[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  const { data } = await supabase.from('follows').select('profile_id').eq('follower_user_id', user.id)
  return (data ?? []).map((f) => f.profile_id)
}
